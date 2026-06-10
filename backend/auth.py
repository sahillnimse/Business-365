# ============================================================
# auth.py — Microsoft Azure AD authentication helpers
#
# All secrets are read from environment variables (backend/.env).
# Never hard-code credentials here.
# ============================================================

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import jwt
import requests
import os

# --------------- load .env automatically ---------------
from dotenv import load_dotenv
load_dotenv()  # reads backend/.env (or any .env in the working dir)

# --------------- credentials from environment ----------
AZURE_TENANT_ID    = os.environ.get("AZURE_TENANT_ID", "")
AZURE_CLIENT_ID    = os.environ.get("AZURE_CLIENT_ID", "")
AZURE_CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET", "")
DUMMY_JWT_SECRET   = os.environ.get("DUMMY_JWT_SECRET", "dummy-secret-key")

security = HTTPBearer(auto_error=False)

# -------------------------------------------------------
# JWKS cache — avoids fetching public keys on every request
# -------------------------------------------------------
_jwks_cache: dict = {}


def _get_ms_jwks(tenant_id: str) -> dict:
    """Fetch and cache Microsoft's public signing keys."""
    if tenant_id in _jwks_cache:
        return _jwks_cache[tenant_id]
    oid_url = (
        f"https://login.microsoftonline.com/{tenant_id}"
        "/v2.0/.well-known/openid-configuration"
    )
    oid_config = requests.get(oid_url, timeout=10).json()
    jwks = requests.get(oid_config["jwks_uri"], timeout=10).json()
    _jwks_cache[tenant_id] = jwks
    return jwks


# -------------------------------------------------------
# verify_ms_token — validates a Bearer token from the frontend
# -------------------------------------------------------
def verify_ms_token(token: str) -> dict:
    """
    Verify a Microsoft-issued JWT (RS256) or a local dev JWT (HS256).
    Returns decoded claims on success, raises HTTPException on failure.
    """
    # --- Try Microsoft RS256 verification ---
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        tenant_id = unverified.get("tid", AZURE_TENANT_ID or "common")

        jwks = _get_ms_jwks(tenant_id)
        header = jwt.get_unverified_header(token)
        public_key = None
        for key_data in jwks.get("keys", []):
            if key_data.get("kid") == header.get("kid"):
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
                break

        if public_key:
            valid_audiences = [AZURE_CLIENT_ID]
            if AZURE_CLIENT_ID and not AZURE_CLIENT_ID.startswith("api://"):
                valid_audiences.append(f"api://{AZURE_CLIENT_ID}")

            claims = jwt.decode(
                token,
                key=public_key,
                algorithms=["RS256"],
                audience=valid_audiences,
                options={"verify_exp": True},
            )
            return claims
    except Exception:
        pass  # RS256 failed — try HS256 below

    # --- Fallback: try HS256 (local dev dummy JWT) ---
    try:
        dummy_claims = jwt.decode(token, DUMMY_JWT_SECRET, algorithms=["HS256"])
        return dummy_claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Token verification failed: {e}",
        )


# -------------------------------------------------------
# get_current_user — FastAPI dependency for protected routes
# -------------------------------------------------------
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    FastAPI dependency — inject into any route that requires authentication.
    Falls back to a local-dev user ONLY when Azure credentials are not set.

    Usage:
        @app.get("/protected")
        def my_route(user: dict = Depends(get_current_user)):
            ...
    """
    # If Azure credentials aren't configured yet → local dev bypass
    if not AZURE_CLIENT_ID or AZURE_CLIENT_ID == "YOUR_CLIENT_ID":
        return {
            "sub": "local-dev",
            "name": "Local Developer",
            "preferred_username": "dev@localhost",
            "tid": "local",
        }

    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header required")

    return verify_ms_token(credentials.credentials)


# -------------------------------------------------------
# check_auth_soft — for /auth/me (never throws 401)
# -------------------------------------------------------
def check_auth_soft(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Soft auth check used by /auth/me.
    Returns {authenticated: False} instead of raising 401
    so the frontend can show the Sign In button.
    """
    if not credentials:
        return {"authenticated": False, "user": None}
    try:
        user = verify_ms_token(credentials.credentials)
        return {
            "authenticated": True,
            "user": {
                "id": user.get("sub"),
                "name": user.get("name"),
                "email": user.get("preferred_username"),
                "tenant_id": user.get("tid"),
            },
        }
    except HTTPException:
        return {"authenticated": False, "user": None}
