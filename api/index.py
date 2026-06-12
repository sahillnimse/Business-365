import sys
import os

# Add backend directory to path so all imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))

# Load .env equivalent — Vercel injects these as real env vars
# so no python-dotenv needed in production

from main import app  # your FastAPI app

# Vercel expects a callable named `app` or `handler`
# mangum wraps ASGI (FastAPI) for AWS Lambda / Vercel serverless
from mangum import Mangum

handler = Mangum(app, lifespan="off")