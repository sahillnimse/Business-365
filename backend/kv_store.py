import os
from typing import Optional

# Prefix for all keys in Vercel KV to avoid collisions
KV_PREFIX = "b365:"

def _get_redis():
    """Create and return an Upstash Redis client if KV env vars are present.
    Returns None if not configured (fallback to .env)."""
    try:
        from upstash_redis import Redis
    except Exception:
        return None
    url = os.getenv("KV_REST_API_URL")
    token = os.getenv("KV_REST_API_TOKEN")
    if url and token:
        return Redis(url=url, token=token)
    return None

def kv_get(key: str, fallback_env: Optional[str] = None) -> Optional[str]:
    """Retrieve a value from Vercel KV.
    Falls back to a local environment variable if KV is not configured.
    """
    redis = _get_redis()
    if redis:
        value = redis.get(f"{KV_PREFIX}{key}")
        if value is not None:
            # Upstash returns bytes; decode to str if needed
            if isinstance(value, bytes):
                return value.decode()
            return str(value)
    if fallback_env:
        return os.getenv(fallback_env)
    return None

def kv_set(key: str, value: str) -> bool:
    """Set a value in Vercel KV (or fallback to .env).
    Returns True on success.
    """
    redis = _get_redis()
    if redis:
        redis.set(f"{KV_PREFIX}{key}", value)
        return True
    # Fallback: write to .env file (handled by caller) – here we just set env var
    os.environ[key] = value
    return True

def kv_delete(key: str) -> bool:
    """Delete a key from Vercel KV (or fallback to .env).
    Returns True on success.
    """
    redis = _get_redis()
    if redis:
        redis.delete(f"{KV_PREFIX}{key}")
        return True
    os.environ.pop(key, None)
    return True
