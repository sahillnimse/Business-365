import os
import pandas as pd
from pathlib import Path
from config import LOCAL_DATA_PATH, FILE_NAMES, DATA_SOURCE, AZURE, SHAREPOINT, BC

# ============================================================
# LOCAL LOADER — reads from local machine path
# ============================================================
def load_local(filename: str) -> pd.DataFrame:
    path = Path(LOCAL_DATA_PATH) / filename
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    df = pd.read_excel(path)
    df.columns = df.columns.str.strip()
    return df

# ============================================================
# SHAREPOINT LOADER — placeholder, ready to activate
# ============================================================
def load_sharepoint(filename: str) -> pd.DataFrame:
    # TODO: Activate when Azure credentials are available
    # from office365.sharepoint.client_context import ClientContext
    # from office365.runtime.auth.client_credential import ClientCredential
    # ctx = ClientContext(SHAREPOINT["site_url"]).with_credentials(
    #     ClientCredential(AZURE["client_id"], AZURE["client_secret"])
    # )
    # file_url = SHAREPOINT["folder_path"] + filename
    # response = File.open_binary(ctx, file_url)
    # import io
    # return pd.read_excel(io.BytesIO(response.content))
    raise NotImplementedError("SharePoint loader not yet configured. Set Azure credentials in config.py")

# ============================================================
# BUSINESS CENTRAL LOADER — placeholder, ready to activate
# ============================================================
def load_bc_items() -> pd.DataFrame:
    # TODO: Activate when Azure credentials are available
    raise NotImplementedError("BC loader not yet configured. Set Azure credentials in config.py")

# ============================================================
# MAIN LOADERS — use DATA_SOURCE from config
# Raises ValueError for unknown DATA_SOURCE so errors are explicit.
# ============================================================
def get_item_master() -> pd.DataFrame:
    if DATA_SOURCE == "local":
        return load_local(FILE_NAMES["item_master"])
    elif DATA_SOURCE == "sharepoint":
        return load_sharepoint(FILE_NAMES["item_master"])
    elif DATA_SOURCE == "bc":
        return load_bc_items()
    else:
        raise ValueError(f"Unknown DATA_SOURCE: '{DATA_SOURCE}'. Expected 'local', 'sharepoint', or 'bc'.")

def get_code_mapping() -> pd.DataFrame:
    if DATA_SOURCE == "local":
        return load_local(FILE_NAMES["code_mapping"])
    elif DATA_SOURCE == "sharepoint":
        return load_sharepoint(FILE_NAMES["code_mapping"])
    else:
        raise ValueError(f"Unknown DATA_SOURCE: '{DATA_SOURCE}'. Expected 'local' or 'sharepoint'.")

def get_po_lines() -> pd.DataFrame:
    if DATA_SOURCE == "local":
        return load_local(FILE_NAMES["po_file"])
    elif DATA_SOURCE == "sharepoint":
        return load_sharepoint(FILE_NAMES["po_file"])
    else:
        raise ValueError(f"Unknown DATA_SOURCE: '{DATA_SOURCE}'. Expected 'local' or 'sharepoint'.")