# ============================================================
# config.py — All settings in one place
# ============================================================
# LOCAL FILE PATH (current — reads Excel files from your machine)
# Change this to point to wherever the client stores the files
LOCAL_DATA_PATH = "./data"

FILE_NAMES = {
    "item_master":    "Item_Master.xlsx",
    "code_mapping":   "Code_Mapping_Table.xlsx",
    "po_file":        "Sample_PO_File.xlsx",
}

# ============================================================
# MICROSOFT AZURE CREDENTIALS (plug in when ready)
# ============================================================
AZURE = {
    "tenant_id":     "YOUR_TENANT_ID",        # Azure AD → Overview → Tenant ID
    "client_id":     "YOUR_CLIENT_ID",        # App Registration → Application (client) ID
    "client_secret": "YOUR_CLIENT_SECRET",    # App Registration → Certificates & Secrets
}

# ============================================================
# SHAREPOINT / ONEDRIVE (plug in when ready)
# ============================================================
SHAREPOINT = {
    "site_url":      "https://xarkaaitechnologiesprivatel.sharepoint.com/sites/ItemCodeValidation-Dev",
    "folder_path":   "/PO-Validation/",
}

# ============================================================
# BUSINESS CENTRAL (plug in when ready)
# ============================================================
BC = {
    "environment":   "production",            # or "sandbox"
    "company_name":  "YOUR_COMPANY_NAME",     # as shown in BC Settings
    "base_url":      "https://api.businesscentral.dynamics.com/v2.0",
}

# ============================================================
# DATA SOURCE — switch between "local", "sharepoint", "bc"
# ============================================================
DATA_SOURCE = "local"   # change to "sharepoint" or "bc" when ready