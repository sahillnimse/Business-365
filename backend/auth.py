from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pathlib import Path
from typing import Optional
import json
import os

import jwt
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID", "")
AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID", "")
AZURE_CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET", "")
DUMMY_JWT_SECRET = os.environ.get("DUMMY_JWT_SECRET", "dummy-secret-key")

GRAPH_AUDIENCE = "00000003-0000-0000-c000-000000000000"

security = HTTPBearer(auto_error=False)
_jwks_cache: dict[str, dict] = {}


def _get_ms_jwks(tenant_id: str) -> dict:
    if tenant_id in _jwks_cache:
        return _jwks_cache[tenant_id]

    oid_url = f"https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration"
    oid_response = requests.get(oid_url, timeout=10)
    oid_response.raise_for_status()
    oid_config = oid_response.json()

    jwks_response = requests.get(oid_config["jwks_uri"], timeout=10)
    jwks_response.raise_for_status()
    jwks = jwks_response.json()
    _jwks_cache[tenant_id] = jwks
    return jwks


def _valid_audiences() -> list[str]:
    audiences = [AZURE_CLIENT_ID]
    if AZURE_CLIENT_ID and not AZURE_CLIENT_ID.startswith("api://"):
        audiences.append(f"api://{AZURE_CLIENT_ID}")
    return [audience for audience in audiences if audience]


def _token_audiences(unverified: dict) -> list[str]:
    aud = unverified.get("aud")
    if isinstance(aud, list):
        return [str(a) for a in aud]
    if aud:
        return [str(aud)]
    return []


def _is_graph_token(unverified: dict) -> bool:
    return GRAPH_AUDIENCE in _token_audiences(unverified)


def _decode_ms_jwt(token: str, public_key, unverified: dict) -> dict:
    audiences = _valid_audiences()
    if not audiences:
        raise ValueError("AZURE_CLIENT_ID is not configured on the server")

    if _is_graph_token(unverified):
        raise ValueError(
            "Token audience is Microsoft Graph, not this application. "
            "The frontend must send the Microsoft ID token (idToken), not the Graph access token."
        )

    tenant_id = unverified.get("tid") or AZURE_TENANT_ID or "common"
    issuers = [
        unverified.get("iss"),
        f"https://login.microsoftonline.com/{tenant_id}/v2.0",
        f"https://sts.windows.net/{tenant_id}/",
    ]
    issuers = [issuer for issuer in issuers if issuer]

    last_error: Exception | None = None
    for issuer in issuers:
        try:
            return jwt.decode(
                token,
                key=public_key,
                algorithms=["RS256"],
                audience=audiences,
                issuer=issuer,
                leeway=60,
                options={"verify_exp": True},
            )
        except jwt.InvalidIssuerError as exc:
            last_error = exc
            continue

    try:
        return jwt.decode(
            token,
            key=public_key,
            algorithms=["RS256"],
            audience=audiences,
            leeway=60,
            options={"verify_exp": True, "verify_iss": False},
        )
    except Exception as exc:
        last_error = exc
        raise ValueError(str(last_error or exc)) from exc


import logging
logger = logging.getLogger(__name__)

def verify_ms_token(token: str) -> dict:
    ms_error = "Microsoft token verification was not attempted"
    azure_enabled = bool(AZURE_CLIENT_ID and AZURE_CLIENT_ID != "YOUR_CLIENT_ID")

    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        tenant_id = unverified.get("tid") or AZURE_TENANT_ID or "common"
        header = jwt.get_unverified_header(token)
        jwks = _get_ms_jwks(tenant_id)

        public_key = None
        for key_data in jwks.get("keys", []):
            if key_data.get("kid") == header.get("kid"):
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
                break

        if not public_key:
            raise ValueError("Token signing key was not found in Microsoft JWKS")

        return _decode_ms_jwt(token, public_key, unverified)
    except Exception as exc:
        ms_error = str(exc)
        logger.error(f"Microsoft token verification failed: {exc}", exc_info=True)

    if azure_enabled:
        raise HTTPException(
            status_code=401,
            detail=f"Microsoft sign-in token was rejected: {ms_error}",
        )

    try:
        return jwt.decode(token, DUMMY_JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=f"Token verification failed. Microsoft: {ms_error}; local JWT: {exc}",
        )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
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


def map_ms_user(claims: dict) -> dict:
    roles = claims.get("roles") or []
    if isinstance(roles, str):
        roles = [roles]

    email = (
        claims.get("preferred_username")
        or claims.get("email")
        or claims.get("upn")
    )
    name = claims.get("name")
    if not name and (claims.get("given_name") or claims.get("family_name")):
        name = " ".join(
            part for part in [claims.get("given_name"), claims.get("family_name")] if part
        ).strip()

    return {
        "id": claims.get("oid") or claims.get("sub"),
        "object_id": claims.get("oid"),
        "subject": claims.get("sub"),
        "name": name,
        "given_name": claims.get("given_name"),
        "family_name": claims.get("family_name"),
        "email": email,
        "username": claims.get("preferred_username") or claims.get("upn") or email,
        "tenant_id": claims.get("tid"),
        "roles": roles,
        "job_title": claims.get("jobTitle"),
        "identity_provider": claims.get("idp") or "Microsoft Entra ID",
        "auth_provider": "microsoft",
        "token_version": claims.get("ver"),
        "issued_at": claims.get("iat"),
        "expires_at": claims.get("exp"),
    }


def check_auth_soft(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if not credentials:
        return {"authenticated": False, "user": None}

    try:
        claims = verify_ms_token(credentials.credentials)
    except HTTPException as exc:
        return {"authenticated": False, "user": None, "detail": exc.detail}

    return {"authenticated": True, "user": map_ms_user(claims)}


def get_profile_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if not AZURE_CLIENT_ID or AZURE_CLIENT_ID == "YOUR_CLIENT_ID":
        return {
            "authenticated": True,
            "user": map_ms_user({
                "sub": "local-dev",
                "oid": "local-dev",
                "name": "Local Developer",
                "preferred_username": "dev@localhost",
                "tid": "local",
                "roles": ["Developer"],
            }),
        }

    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header required")

    claims = verify_ms_token(credentials.credentials)
    return {"authenticated": True, "user": map_ms_user(claims)}
