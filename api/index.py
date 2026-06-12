import sys
import os

# Add backend directory to path so all imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))

# Load .env equivalent — Vercel injects these as real env vars
# so no python-dotenv needed in production

from main import app as fastapi_app

class StripApiPrefixMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            path = scope.get("path", "")
            if path.startswith("/api"):
                new_path = path[4:] or "/"
                scope["path"] = new_path
                if "raw_path" in scope:
                    scope["raw_path"] = new_path.encode("utf-8")
        await self.app(scope, receive, send)

app = StripApiPrefixMiddleware(fastapi_app)

# Vercel expects a callable named `app` or `handler`
# mangum wraps ASGI (FastAPI) for AWS Lambda / Vercel serverless
from mangum import Mangum

handler = Mangum(app, lifespan="off")