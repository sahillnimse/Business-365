# ============================================================
# config.py — Non-secret application settings
#
# Secrets (Azure credentials, JWT keys) are in backend/.env
# and loaded automatically by auth.py via python-dotenv.
# ============================================================
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# ============================================================
# LOCAL FILE PATH
# ============================================================
if os.environ.get("VERCEL"):
    LOCAL_DATA_PATH = Path("/tmp/data")
else:
    LOCAL_DATA_PATH = BASE_DIR / "data"

FILE_NAMES = {
    "item_master":  "Item_Master.xlsx",
    "code_mapping": "Code_Mapping_Table.xlsx",
    "po_file":      "Sample_PO_File.xlsx",
}

# ============================================================
# MICROSOFT AZURE — read from .env, no hard-coded secrets
# ============================================================
AZURE = {
    "tenant_id":     os.environ.get("AZURE_TENANT_ID", ""),
    "client_id":     os.environ.get("AZURE_CLIENT_ID", ""),
    "client_secret": os.environ.get("AZURE_CLIENT_SECRET", ""),
}

# Local dev JWT secret (also from .env)
DUMMY_JWT_SECRET = os.environ.get("DUMMY_JWT_SECRET", "dummy-secret-key")

# ============================================================
# SHAREPOINT / ONEDRIVE
# ============================================================
SHAREPOINT = {
    "site_url":    "https://xarkaaitechnologiesprivatel.sharepoint.com/sites/ItemCodeValidation-Dev",
    "folder_path": "/PO-Validation/",
}

# ============================================================
# BUSINESS CENTRAL
# ============================================================
BC = {
    "environment":  os.environ.get("BC_ENVIRONMENT", "production"),
    "company_name": os.environ.get("BC_COMPANY_NAME", "YOUR_COMPANY_NAME"),
    "base_url":     "https://api.businesscentral.dynamics.com/v2.0",
}

BC_DELEGATED_SCOPE = "https://api.businesscentral.dynamics.com/user_impersonation"

# ============================================================
# DATA SOURCE — "local" | "sharepoint" | "bc"
# ============================================================
DATA_SOURCE = os.environ.get("DATA_SOURCE", "local")

# ============================================================
# CONFIG VALIDATIONS
# ============================================================
if DATA_SOURCE == "bc":
    if not AZURE.get("tenant_id") or not AZURE.get("client_id") or AZURE.get("client_id") == "YOUR_CLIENT_ID":
        raise RuntimeError("Cannot use 'bc' (Business Central) mode without proper Azure tenant_id and client_id configuration.")

