"""Per-request Business Central delegated access token (from frontend MSAL)."""

from contextvars import ContextVar

bc_access_token: ContextVar[str | None] = ContextVar("bc_access_token", default=None)


def get_bc_access_token() -> str | None:
    return bc_access_token.get()


def set_bc_access_token(token: str | None) -> None:
    bc_access_token.set(token)
