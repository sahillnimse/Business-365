# ============================================================
# main.py — FastAPI application
#
# Authentication helpers (verify_ms_token, get_current_user,
# check_auth_soft) are implemented in auth.py and re-exported
# here.  Secrets are loaded from backend/.env via python-dotenv.
# ============================================================

from fastapi import FastAPI, HTTPException, Depends, Request, Body, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime, timezone, timedelta
import os 
import jwt
from kv_store import kv_get, kv_set, kv_delete
import pandas as pd
from bc_client import BusinessCentralError

from data_loader import (
    get_item_master,
    get_code_mapping,
    get_po_lines,
    import_uploaded_workbook,
    latest_upload_manifest,
    save_po_trigger,
    upload_status,
)
from config import DATA_SOURCE, SHAREPOINT, BC, AZURE, LOCAL_DATA_PATH, FILE_NAMES, BC_DELEGATED_SCOPE
from bc_context import set_bc_access_token
from auth import (
    AZURE_CLIENT_ID,
    get_current_user,
    check_auth_soft,
    get_profile_user,
    verify_ms_token,
    DUMMY_JWT_SECRET,
)

# Re-export for callers that expect these names directly from main
__all__ = ["verify_ms_token", "get_current_user", "check_auth_soft", "DUMMY_JWT_SECRET"]

app = FastAPI(title="Business 365 API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Tighten to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HEALTH CHECK (public)
# ============================================================
def _azure_secrets_configured() -> bool:
    secret = AZURE.get("client_secret", "")
    return bool(
        AZURE.get("client_id")
        and AZURE.get("tenant_id")
        and secret
        and secret not in ("", "YOUR_CLIENT_SECRET_HERE")
    )


def _local_files_ready() -> bool:
    return all((LOCAL_DATA_PATH / name).exists() for name in FILE_NAMES.values())


def _bc_configured() -> bool:
    company = BC.get("company_name", "")
    return bool(
        DATA_SOURCE == "bc"
        and AZURE.get("tenant_id")
        and AZURE.get("client_id")
        and company
        and company != "YOUR_COMPANY_NAME"
    )


def _connections_status() -> dict:
    azure_ok = _azure_secrets_configured()
    local_ok = _local_files_ready()
    bc_mode = DATA_SOURCE == "bc"
    return {
        "data_source": DATA_SOURCE,
        "microsoft_login": bool(AZURE_CLIENT_ID and AZURE_CLIENT_ID != "YOUR_CLIENT_ID"),
        "azure_app_configured": azure_ok,
        "local_files_ready": local_ok,
        "sharepoint_configured": DATA_SOURCE == "sharepoint" and azure_ok,
        "business_central_configured": bc_mode and bool(AZURE.get("tenant_id") and AZURE.get("client_id")),
        "bc_company_configured": _bc_configured(),
        "bc_auth_mode": "delegated" if bc_mode else None,
        "bc_scope": BC_DELEGATED_SCOPE if bc_mode else None,
        "sharepoint_site": SHAREPOINT["site_url"],
        "bc_environment": BC["environment"],
        "bc_company": BC["company_name"],
        "live_bc_data": bc_mode,
        "note": (
            "Microsoft sign-in only authenticates users. "
            "Set DATA_SOURCE=bc in backend .env to load live Business Central data."
            if DATA_SOURCE == "local"
            else (
                "Business Central data is loaded with your signed-in Microsoft token "
                f"({BC_DELEGATED_SCOPE}). Grant admin consent for user_impersonation."
                if bc_mode
                else "Data is loaded from the configured remote source."
            )
        ),
    }


@app.middleware("http")
async def bc_token_middleware(request: Request, call_next):
    token = request.headers.get("X-BC-Access-Token")
    set_bc_access_token(token or None)
    try:
        return await call_next(request)
    finally:
        set_bc_access_token(None)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        **{k: v for k, v in _connections_status().items() if k != "note"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/connections/status")
def connections_status(user: dict = Depends(get_current_user)):
    return _connections_status()


# ============================================================
# UPLOADS - Excel / CSV intake for item code validation
# ============================================================
@app.get("/uploads/status")
def get_upload_status(user: dict = Depends(get_current_user)):
    try:
        return upload_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/uploads/latest")
def get_latest_upload(user: dict = Depends(get_current_user)):
    try:
        manifest = latest_upload_manifest()
        if not manifest:
            return {"filename": "", "sheet_count": 0, "mapped_count": 0, "mapped": [], "sheets": []}
        return manifest
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/uploads/workbook")
async def upload_workbook(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    try:
        filename = file.filename or "uploaded-workbook.xlsx"
        suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
        if suffix not in {"xlsx", "csv"}:
            raise HTTPException(status_code=400, detail="Upload an Excel workbook (.xlsx) or CSV file.")
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        return import_uploaded_workbook(filename, content)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/teams/po-trigger")
def teams_po_trigger(request: Request, payload: dict = Body(...)):
    import os
    webhook_secret = kv_get("TEAMS_WEBHOOK_SECRET", "TEAMS_WEBHOOK_SECRET")
    if webhook_secret:
        auth_header = request.headers.get("X-Webhook-Secret")
        if auth_header != webhook_secret:
            raise HTTPException(status_code=403, detail="Invalid webhook secret")
    try:
        event = save_po_trigger(payload)
        lines = payload.get("lines")
        
        # Parse the lines from the payload to validate them directly
        custom_df = pd.DataFrame(lines) if lines else pd.DataFrame(columns=[
            "PO Number", "PO Date", "Vendor", "Line #", "Item Code",
            "Description", "Qty", "Unit", "Unit Price (USD)", "Total (USD)"
        ])
        # Standardize columns to match what run_validation_logic expects
        if not custom_df.empty:
            custom_df.columns = [str(col).strip() for col in custom_df.columns]
            custom_df = custom_df.fillna("")

        validation = run_validation_logic(
            user={"preferred_username": payload.get("created_by", "teams-trigger")},
            custom_po_df=custom_df
        )
        return {
            "accepted": True,
            "event": event,
            "validation": {
                "total": validation["total"],
                "pass": validation["pass"],
                "rejected": validation.get("rejected", validation["block_unknown"]),
                "duplicate": validation.get("duplicate", 0),
                "missing_code": validation.get("missing_code", 0),
                "results": validation["results"],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# AUTH — soft check, never returns 401
# The frontend calls this on load to know if the user is logged in.
# ============================================================
@app.get("/auth/me")
def auth_me(result: dict = Depends(check_auth_soft)):
    return result


@app.get("/auth/profile")
def auth_profile(result: dict = Depends(get_profile_user)):
    return result


# ============================================================
# DEV LOGIN — dummy JWT for local development only
# Skipped when AZURE_CLIENT_ID is configured (real credentials).
# The frontend falls back to this endpoint when MSAL is unavailable.
# ============================================================
@app.post("/login")
def login(username: str = Body(..., embed=True)):
    """Return a dummy JWT signed with DUMMY_JWT_SECRET (local dev only)."""
    if AZURE_CLIENT_ID and AZURE_CLIENT_ID != "YOUR_CLIENT_ID":
        raise HTTPException(status_code=404, detail="Local development login is disabled")

    claims = {
        "sub": username,
        "name": username,
        "preferred_username": f"{username}@localhost",
        "tid": "local-dev",
        "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
        "iat": int(datetime.utcnow().timestamp()),
    }
    token = jwt.encode(claims, DUMMY_JWT_SECRET, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer"}


# ============================================================
# ITEM MASTER
# ============================================================
@app.get("/items")
def get_items(
    status: str = None,
    category: str = None,
    search: str = None,
    user: dict = Depends(get_current_user),
):
    try:
        df = get_item_master()
        if status:
            df = df[df["Status"].str.strip() == status]
        if category:
            df = df[df["Category"].str.strip() == category]
        if search:
            df = df[
                df["Item Code"].str.contains(search, case=False, na=False) |
                df["Item Description"].str.contains(search, case=False, na=False)
            ]
        return {"total": len(df), "items": df.fillna("").to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/items/stats")
def get_item_stats(user: dict = Depends(get_current_user)):
    try:
        df = get_item_master()
        return {
            "total": len(df),
            "active": len(df[df["Status"].str.strip() == "Active"]),
            "inactive": len(df[df["Status"].str.strip() == "Inactive"]),
            "categories": df["Category"].nunique(),
            "category_breakdown": df.groupby("Category")["Item Code"].count().to_dict(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# CODE MAPPING
# ============================================================
@app.get("/mappings")
def get_mappings(search: str = None, user: dict = Depends(get_current_user)):
    try:
        df = get_code_mapping()
        if search:
            df = df[
                df["Old Item Code"].str.contains(search, case=False, na=False) |
                df["New Item Code"].str.contains(search, case=False, na=False)
            ]
        return {"total": len(df), "mappings": df.fillna("").to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# PO LINES
# ============================================================
@app.get("/po-lines")
def get_po_lines_endpoint(po_number: str = None, user: dict = Depends(get_current_user)):
    try:
        df = get_po_lines()
        if po_number:
            df = df[df["PO Number"].str.strip() == po_number]
        return {
            "total": len(df),
            "po_numbers": df["PO Number"].unique().tolist(),
            "lines": df.fillna("").to_dict(orient="records"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# FINANCE — derived from PO / purchasing data
# Live BC finance APIs (GL, AP, AR) are not wired yet; this surfaces
# purchasing totals until DATA_SOURCE=bc is fully implemented.
# ============================================================
def _line_amount(row) -> float:
    try:
        qty = float(row.get("Qty", 0) or 0)
        price = float(row.get("Unit Price (USD)", 0) or 0)
        return round(qty * price, 2)
    except (TypeError, ValueError):
        return 0.0


@app.get("/finance/summary")
def finance_summary(user: dict = Depends(get_current_user)):
    try:
        po_df = get_po_lines()
        connections = _connections_status()

        ledger = []
        payables_map: dict[str, dict] = {}

        for _, row in po_df.iterrows():
            po_number = str(row.get("PO Number", "")).strip()
            line_num = str(row.get("Line #", "")).strip()
            vendor = str(row.get("Vendor", "")).strip() or "Unknown vendor"
            item_code = str(row.get("Item Code", "")).strip()
            amount = _line_amount(row)

            ledger.append({
                "date": datetime.now(timezone.utc).date().isoformat(),
                "po_number": po_number,
                "line_num": line_num,
                "account": "Purchases",
                "description": f"{item_code} — {vendor}",
                "debit": amount,
                "credit": 0.0,
                "vendor": vendor,
            })

            bucket = payables_map.setdefault(vendor, {"vendor": vendor, "lines": 0, "total_amount": 0.0})
            bucket["lines"] += 1
            bucket["total_amount"] = round(bucket["total_amount"] + amount, 2)

        payables = sorted(payables_map.values(), key=lambda x: x["total_amount"], reverse=True)
        total_payable = round(sum(p["total_amount"] for p in payables), 2)

        return {
            **connections,
            "currency": "USD",
            "ledger": ledger,
            "payables": payables,
            "receivables": [],
            "bank": {
                "total_payable": total_payable,
                "vendor_count": len(payables),
                "open_po_count": int(po_df["PO Number"].nunique()) if not po_df.empty else 0,
                "open_po_lines": len(po_df),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# VALIDATION — core logic
# ============================================================
def run_validation_logic(user: dict, custom_po_df: pd.DataFrame = None) -> dict:
    item_master_df = get_item_master()
    code_mapping_df = get_code_mapping()
    po_df = custom_po_df if custom_po_df is not None else get_po_lines()

    results = []
    existing_codes = {
        code.lower()
        for code in item_master_df["Item Code"].astype(str).str.strip().tolist()
        if code
    }
    document_counts = po_df["Item Code"].astype(str).str.strip().str.lower().value_counts().to_dict()

    for _, row in po_df.iterrows():
        item_code  = str(row.get("Item Code", "")).strip()
        po_number  = str(row.get("PO Number", "")).strip()
        line_num   = str(row.get("Line #", "")).strip()
        vendor     = str(row.get("Vendor", "")).strip()
        qty        = str(row.get("Qty", "")).strip()
        unit_price = str(row.get("Unit Price (USD)", "")).strip()
        timestamp  = datetime.now(timezone.utc).isoformat()
        normalized_code = item_code.lower()
        validated_by = user.get("preferred_username", "")

        if not item_code:
            results.append({
                "po_number": po_number, "line_num": line_num,
                "vendor": vendor, "qty": qty, "unit_price": unit_price,
                "original_code": item_code, "mapped_code": "N/A",
                "status": "REJECT-MISSING-CODE",
                "message": "Item code was not generated - document not passed.",
                "notification_channel": "Teams / Outlook",
                "notification_message": f"Document {po_number} rejected: item code was not generated.",
                "timestamp": timestamp, "validated_by": validated_by,
            })
            continue

        if document_counts.get(normalized_code, 0) > 1:
            results.append({
                "po_number": po_number, "line_num": line_num,
                "vendor": vendor, "qty": qty, "unit_price": unit_price,
                "original_code": item_code, "mapped_code": "N/A",
                "status": "REJECT-DUPLICATE",
                "message": "Item code is repeated in the uploaded document - document not passed.",
                "notification_channel": "Teams / Outlook",
                "notification_message": f"Document {po_number} rejected: item code {item_code} is repeated in the upload.",
                "timestamp": timestamp, "validated_by": validated_by,
            })
            continue

        if normalized_code in existing_codes:
            results.append({
                "po_number": po_number, "line_num": line_num,
                "vendor": vendor, "qty": qty, "unit_price": unit_price,
                "original_code": item_code, "mapped_code": "N/A",
                "status": "REJECT-EXISTS",
                "message": "Item code already present in master sheet - document not passed.",
                "notification_channel": "Teams / Outlook",
                "notification_message": f"Document {po_number} rejected: item code {item_code} already exists in the master sheet.",
                "timestamp": timestamp, "validated_by": validated_by,
            })
            continue

        results.append({
            "po_number": po_number, "line_num": line_num,
            "vendor": vendor, "qty": qty, "unit_price": unit_price,
            "original_code": item_code, "mapped_code": item_code,
            "status": "PASS",
            "message": "New item code not present in master sheet - document passed and forwarded.",
            "notification_channel": "Teams / Outlook",
            "notification_message": f"Document {po_number} passed: item code {item_code} is new and can be shared forward.",
            "timestamp": timestamp, "validated_by": validated_by,
        })
        continue

        # Check 1 — Active in Item Master
        active = item_master_df[
            (item_master_df["Item Code"].astype(str).str.strip() == item_code) &
            (item_master_df["Status"].astype(str).str.strip() == "Active")
        ]
        if not active.empty:
            results.append({
                "po_number": po_number, "line_num": line_num,
                "vendor": vendor, "qty": qty, "unit_price": unit_price,
                "original_code": item_code, "mapped_code": item_code,
                "status": "PASS", "message": "Active code confirmed",
                "timestamp": timestamp, "validated_by": user.get("preferred_username", ""),
            })
            continue

        # Check 2 — In Code Mapping
        mapping = code_mapping_df[
            code_mapping_df["Old Item Code"].astype(str).str.strip() == item_code
        ]
        if not mapping.empty:
            new_code = str(mapping.iloc[0]["New Item Code"]).strip()
            results.append({
                "po_number": po_number, "line_num": line_num,
                "vendor": vendor, "qty": qty, "unit_price": unit_price,
                "original_code": item_code, "mapped_code": new_code,
                "status": "AUTO-MAP", "message": f"Remapped to {new_code}",
                "timestamp": timestamp, "validated_by": user.get("preferred_username", ""),
            })
            continue

        # Check 3 — Inactive in Item Master
        inactive = item_master_df[
            (item_master_df["Item Code"].astype(str).str.strip() == item_code) &
            (item_master_df["Status"].astype(str).str.strip() == "Inactive")
        ]
        if not inactive.empty:
            results.append({
                "po_number": po_number, "line_num": line_num,
                "vendor": vendor, "qty": qty, "unit_price": unit_price,
                "original_code": item_code, "mapped_code": "N/A",
                "status": "BLOCK-INACTIVE", "message": "Code is inactive, no replacement",
                "timestamp": timestamp, "validated_by": user.get("preferred_username", ""),
            })
            continue

        # Check 4 — Completely unknown
        results.append({
            "po_number": po_number, "line_num": line_num,
            "vendor": vendor, "qty": qty, "unit_price": unit_price,
            "original_code": item_code, "mapped_code": "UNKNOWN",
            "status": "BLOCK-UNKNOWN", "message": "Code not found anywhere",
            "timestamp": timestamp, "validated_by": user.get("preferred_username", ""),
        })

    rejected = [r for r in results if r["status"].startswith("REJECT")]
    return {
        "total":          len(results),
        "pass":           len([r for r in results if r["status"] == "PASS"]),
        "auto_map":       len([r for r in results if r["status"] == "AUTO-MAP"]),
        "block_inactive": len([r for r in results if r["status"] == "BLOCK-INACTIVE"]),
        "block_unknown":  len([r for r in results if r["status"] == "BLOCK-UNKNOWN"]) + len(rejected),
        "duplicate":      len([r for r in results if r["status"] in ("REJECT-DUPLICATE", "REJECT-EXISTS")]),
        "missing_code":   len([r for r in results if r["status"] == "REJECT-MISSING-CODE"]),
        "rejected":       len(rejected),
        "results":        results,
    }


@app.get("/validate")
def validate(user: dict = Depends(get_current_user)):
    try:
        return run_validation_logic(user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# WEBHOOK SETTINGS
# ============================================================
@app.get("/settings/webhook")
def get_webhook_settings(request: Request, user: dict = Depends(get_current_user)):
    import os
    base_url = str(request.base_url).rstrip("/")
    if "/api" in request.url.path or "vercel" in base_url or os.getenv("VERCEL"):
        webhook_url = f"{base_url}/api/teams/po-trigger"
    else:
        webhook_url = f"{base_url}/teams/po-trigger"

    # Determine storage backend
    storage_backend = "vercel-kv" if os.getenv("KV_REST_API_URL") and os.getenv("KV_REST_API_TOKEN") else "env"
    secret = kv_get("TEAMS_WEBHOOK_SECRET", "TEAMS_WEBHOOK_SECRET")
    secret_configured = bool(secret)
    secret_preview = secret[:4] + "****" if secret else ""
    return {
        "webhook_url": webhook_url,
        "secret_configured": secret_configured,
        "secret_preview": secret_preview,
        "storage_backend": storage_backend,
    }


@app.post("/settings/webhook")
def update_webhook_settings(payload: dict = Body(...), user: dict = Depends(get_current_user)):
    secret = payload.get("secret", "").strip()
    if secret and len(secret) < 16:
        raise HTTPException(status_code=400, detail="Webhook secret must be at least 16 characters")
    # Save secret via KV if available, else fallback to env write (handled elsewhere)
    if secret:
        kv_set("TEAMS_WEBHOOK_SECRET", secret)
        os.environ["TEAMS_WEBHOOK_SECRET"] = secret
    else:
        # Delete secret if empty
        kv_delete("TEAMS_WEBHOOK_SECRET")
        os.environ.pop("TEAMS_WEBHOOK_SECRET", None)
        secret = ""
    secret_configured = bool(secret)
    secret_preview = secret[:4] + "****" if secret else ""
    return {"status": "success", "secret_configured": secret_configured, "secret_preview": secret_preview}



@app.delete("/settings/webhook/secret")
def delete_webhook_secret(user: dict = Depends(get_current_user)):
    kv_delete("TEAMS_WEBHOOK_SECRET")
    os.environ.pop("TEAMS_WEBHOOK_SECRET", None)
    return {"status": "deleted"}

# DASHBOARD SUMMARY
# ============================================================
@app.get("/dashboard")
def dashboard(user: dict = Depends(get_current_user)):
    import logging
    _logger = logging.getLogger(__name__)
    try:
        item_df = get_item_master()
        item_stats = {
            "total": len(item_df),
            "active": len(item_df[item_df["Status"].str.strip() == "Active"]),
            "inactive": len(item_df[item_df["Status"].str.strip() == "Inactive"]),
            "categories": item_df["Category"].nunique(),
        }

        validation = run_validation_logic(user)

        po_df = get_po_lines()
        po_data = {
            "total_lines": len(po_df),
            "total_pos": po_df["PO Number"].nunique(),
            "po_numbers": po_df["PO Number"].unique().tolist(),
        }

        mapping_df = get_code_mapping()

        return {
            "items": item_stats,
            "validation": {
                "total":          validation["total"],
                "pass":           validation["pass"],
                "auto_map":       validation["auto_map"],
                "block_inactive": validation["block_inactive"],
                "block_unknown":  validation["block_unknown"],
                "duplicate":      validation.get("duplicate", 0),
                "missing_code":   validation.get("missing_code", 0),
                "rejected":       validation.get("rejected", 0),
            },
            "po": po_data,
            "mappings": {"total": len(mapping_df)},
        }
    except BusinessCentralError as bc_err:
        _logger.warning(f"Dashboard BC token issue: {bc_err}")
        return {
            "error": str(bc_err),
            "detail": "Business Central token missing or invalid. Use 'Connect Business Central' in Settings.",
        }
    except Exception as e:
        _logger.error(f"Dashboard endpoint failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# FALLBACK — catch-all error handlers
# ============================================================
@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not found",
            "path": str(request.url.path),
            "hint": "Check the API docs at /docs",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.exception_handler(405)
async def method_not_allowed_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=405,
        content={
            "error": "Method not allowed",
            "method": request.method,
            "path": str(request.url.path),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
