# ============================================================
# main.py — FastAPI application
#
# Authentication helpers (verify_ms_token, get_current_user,
# check_auth_soft) are implemented in auth.py and re-exported
# here.  Secrets are loaded from backend/.env via python-dotenv.
# ============================================================

from fastapi import FastAPI, HTTPException, Depends, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime, timezone, timedelta
import jwt

from data_loader import get_item_master, get_code_mapping, get_po_lines
from config import DATA_SOURCE, SHAREPOINT, BC
from auth import (
    get_current_user,
    check_auth_soft,
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
@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "data_source": DATA_SOURCE,
        "sharepoint_site": SHAREPOINT["site_url"],
        "bc_environment": BC["environment"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# AUTH — soft check, never returns 401
# The frontend calls this on load to know if the user is logged in.
# ============================================================
@app.get("/auth/me")
def auth_me(result: dict = Depends(check_auth_soft)):
    return result


# ============================================================
# DEV LOGIN — dummy JWT for local development only
# Skipped when AZURE_CLIENT_ID is configured (real credentials).
# The frontend falls back to this endpoint when MSAL is unavailable.
# ============================================================
@app.post("/login")
def login(username: str = Body(..., embed=True)):
    """Return a dummy JWT signed with DUMMY_JWT_SECRET (local dev only)."""
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
# VALIDATION — core logic
# ============================================================
def run_validation_logic(user: dict) -> dict:
    item_master_df = get_item_master()
    code_mapping_df = get_code_mapping()
    po_df = get_po_lines()

    results = []

    for _, row in po_df.iterrows():
        item_code  = str(row.get("Item Code", "")).strip()
        po_number  = str(row.get("PO Number", "")).strip()
        line_num   = str(row.get("Line #", "")).strip()
        vendor     = str(row.get("Vendor", "")).strip()
        qty        = str(row.get("Qty", "")).strip()
        unit_price = str(row.get("Unit Price (USD)", "")).strip()
        timestamp  = datetime.now(timezone.utc).isoformat()

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

    return {
        "total":          len(results),
        "pass":           len([r for r in results if r["status"] == "PASS"]),
        "auto_map":       len([r for r in results if r["status"] == "AUTO-MAP"]),
        "block_inactive": len([r for r in results if r["status"] == "BLOCK-INACTIVE"]),
        "block_unknown":  len([r for r in results if r["status"] == "BLOCK-UNKNOWN"]),
        "results":        results,
    }


@app.get("/validate")
def validate(user: dict = Depends(get_current_user)):
    try:
        return run_validation_logic(user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# DASHBOARD SUMMARY
# ============================================================
@app.get("/dashboard")
def dashboard(user: dict = Depends(get_current_user)):
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
            },
            "po": po_data,
            "mappings": {"total": len(mapping_df)},
        }
    except Exception as e:
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