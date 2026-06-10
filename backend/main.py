from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from typing import Optional
import jwt
import requests

from data_loader import get_item_master, get_code_mapping, get_po_lines
from config import DATA_SOURCE, SHAREPOINT, BC, AZURE

app = FastAPI(title="Business 365 API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    #allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# MICROSOFT TOKEN VERIFICATION
# ============================================================
security = HTTPBearer(auto_error=False)

_jwks_cache: dict = {}

def get_ms_jwks(tenant_id: str) -> dict:
    """Fetch Microsoft's public keys (cached)."""
    if tenant_id in _jwks_cache:
        return _jwks_cache[tenant_id]
    oid_config_url = f"https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration"
    oid_config = requests.get(oid_config_url, timeout=10).json()
    jwks = requests.get(oid_config["jwks_uri"], timeout=10).json()
    _jwks_cache[tenant_id] = jwks
    return jwks


def verify_ms_token(token: str) -> dict:
    """
    Verify a Microsoft-issued JWT.
    Returns decoded claims on success, raises HTTPException on failure.
    """
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        tenant_id = unverified.get("tid", AZURE.get("tenant_id", "common"))

        jwks = get_ms_jwks(tenant_id)
        header = jwt.get_unverified_header(token)
        public_key = None
        for key_data in jwks.get("keys", []):
            if key_data.get("kid") == header.get("kid"):
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
                break

        if not public_key:
            raise HTTPException(status_code=401, detail="Token signing key not found")

        claims = jwt.decode(
            token,
            key=public_key,
            algorithms=["RS256"],
            audience=AZURE.get("client_id"),
            options={"verify_exp": True},
        )
        return claims

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Dependency — returns user claims from verified MS token.
    Falls back to a local dev user when AZURE credentials aren't configured.
    """
    client_id = AZURE.get("client_id", "")
    if not client_id or client_id == "YOUR_CLIENT_ID":
        return {
            "sub": "local-dev",
            "name": "Local Developer",
            "preferred_username": "dev@localhost",
            "tid": "local",
        }

    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header required")

    return verify_ms_token(credentials.credentials)


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
# AUTH — verify MS token and return user info
# ============================================================
@app.get("/auth/me")
def auth_me(user: dict = Depends(get_current_user)):
    return {
        "authenticated": True,
        "user": {
            "id": user.get("sub"),
            "name": user.get("name"),
            "email": user.get("preferred_username"),
            "tenant_id": user.get("tid"),
        },
    }


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
    """
    Pure validation logic extracted so it can be called both
    by the /validate endpoint and the /dashboard endpoint
    without going through FastAPI's Depends() injection.
    """
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
# — calls helper functions directly, not FastAPI route handlers
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
# FALLBACK — catch-all 404 for unknown API routes
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