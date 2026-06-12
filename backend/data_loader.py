import io
import json
import os
import pandas as pd
from pathlib import Path
from config import LOCAL_DATA_PATH, FILE_NAMES, DATA_SOURCE, AZURE, SHAREPOINT, BC

DATASET_LABELS = {
    "item_master": "Item master",
    "code_mapping": "Code mapping",
    "po_file": "Document lines",
}

DATASET_ALIASES = {
    "item_master": {
        "itemmaster",
        "itemmasterlist",
        "master",
        "item",
        "items",
        "inventory",
        "itemlist",
    },
    "code_mapping": {
        "codemapping",
        "mapping",
        "mappings",
        "replacement",
        "replacements",
    },
    "po_file": {
        "po",
        "polines",
        "purchaseorder",
        "purchaseorders",
        "document",
        "documents",
        "upload",
        "request",
    },
}

UPLOAD_MANIFEST = LOCAL_DATA_PATH / "last_upload_manifest.json"
TRIGGER_EVENT_FILE = LOCAL_DATA_PATH / "last_po_trigger.json"


def _clean_key(value: str) -> str:
    return "".join(ch for ch in str(value).lower() if ch.isalnum())


def _normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.dropna(how="all").copy()
    df.columns = [str(col).strip() for col in df.columns]
    return df.fillna("")


def _sheet_preview(df: pd.DataFrame) -> dict:
    clean = _normalize_df(df)
    return {
        "columns": clean.columns.tolist(),
        "row_count": len(clean),
        "rows": clean.head(25).to_dict(orient="records"),
    }


def detect_dataset(sheet_name: str, df: pd.DataFrame) -> str | None:
    sheet_key = _clean_key(sheet_name)
    for dataset, aliases in DATASET_ALIASES.items():
        if sheet_key in aliases:
            return dataset

    columns = {_clean_key(col) for col in df.columns}
    if {"olditemcode", "newitemcode"}.issubset(columns):
        return "code_mapping"
    if "ponumber" in columns or {"line", "itemcode", "vendor"}.issubset(columns):
        return "po_file"
    if "itemcode" in columns and ({"itemdescription", "status"} & columns or "category" in columns):
        return "item_master"
    return None

SCHEMAS = {
    "item_master": ["Item Code", "Item Description", "Category", "Status", "Unit", "Unit Price (USD)"],
    "code_mapping": ["Old Item Code", "Old Description", "New Item Code", "New Description", "Reason for Change", "Effective Date", "Mapped By"],
    "po_file": ["PO Number", "PO Date", "Vendor", "Line #", "Item Code", "Description", "Qty", "Unit", "Unit Price (USD)", "Total (USD)"]
}

FILE_NAME_TO_DATASET = {
    "Item_Master.xlsx": "item_master",
    "Code_Mapping_Table.xlsx": "code_mapping",
    "Sample_PO_File.xlsx": "po_file",
}

def _enforce_schema(df: pd.DataFrame, schema_name: str) -> pd.DataFrame:
    schema = SCHEMAS.get(schema_name, [])
    for col in schema:
        if col not in df.columns:
            df[col] = ""
    return df

def _ensure_file(filename: str) -> Path:
    path = Path(LOCAL_DATA_PATH) / filename
    if not path.exists():
        packaged_dir = Path(__file__).resolve().parent / "data"
        packaged_path = packaged_dir / filename
        if packaged_path.exists():
            LOCAL_DATA_PATH.mkdir(parents=True, exist_ok=True)
            import shutil
            shutil.copy2(packaged_path, path)
    return path


def read_uploaded_tables(filename: str, content: bytes) -> dict[str, pd.DataFrame]:
    suffix = Path(filename).suffix.lower()
    buffer = io.BytesIO(content)
    if suffix == ".csv":
        return {Path(filename).stem or "CSV Upload": pd.read_csv(buffer)}
    return pd.read_excel(buffer, sheet_name=None)


def save_dataset(dataset: str, df: pd.DataFrame) -> dict:
    if dataset not in FILE_NAMES:
        raise ValueError(f"Unknown dataset: {dataset}")
    LOCAL_DATA_PATH.mkdir(parents=True, exist_ok=True)
    clean = _normalize_df(df)
    path = LOCAL_DATA_PATH / FILE_NAMES[dataset]
    clean.to_excel(path, index=False)
    return {
        "dataset": dataset,
        "label": DATASET_LABELS.get(dataset, dataset),
        "filename": FILE_NAMES[dataset],
        "rows": len(clean),
        "columns": clean.columns.tolist(),
    }


def import_uploaded_workbook(filename: str, content: bytes) -> dict:
    tables = read_uploaded_tables(filename, content)
    sheets = []
    mapped = []
    seen_datasets: set[str] = set()

    for sheet_name, df in tables.items():
        clean = _normalize_df(df)
        dataset = detect_dataset(sheet_name, clean)
        sheet = {
            "name": sheet_name,
            "mapped_to": dataset,
            **_sheet_preview(clean),
        }
        sheets.append(sheet)

        if dataset and dataset not in seen_datasets:
            mapped.append(save_dataset(dataset, clean))
            seen_datasets.add(dataset)

    result = {
        "filename": filename,
        "sheet_count": len(sheets),
        "mapped_count": len(mapped),
        "mapped": mapped,
        "sheets": sheets,
    }
    save_upload_manifest(result)
    return result


def save_upload_manifest(result: dict) -> None:
    LOCAL_DATA_PATH.mkdir(parents=True, exist_ok=True)
    UPLOAD_MANIFEST.write_text(json.dumps(result, default=str), encoding="utf-8")


def latest_upload_manifest() -> dict | None:
    if not UPLOAD_MANIFEST.exists():
        return None
    try:
        return json.loads(UPLOAD_MANIFEST.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def save_po_trigger(payload: dict) -> dict:
    lines = payload.get("lines")
    if not isinstance(lines, list) or not lines:
        raise ValueError("Trigger payload must include a non-empty 'lines' array")

    df = _normalize_df(pd.DataFrame(lines))
    saved = save_dataset("po_file", df)
    event = {
        "source": payload.get("source", "teams"),
        "po_number": payload.get("po_number") or str(df.iloc[0].get("PO Number", "")),
        "received_at": pd.Timestamp.utcnow().isoformat(),
        "saved": saved,
        "lines": len(df),
    }
    LOCAL_DATA_PATH.mkdir(parents=True, exist_ok=True)
    TRIGGER_EVENT_FILE.write_text(json.dumps(event, default=str), encoding="utf-8")
    return event


def latest_po_trigger() -> dict | None:
    if not TRIGGER_EVENT_FILE.exists():
        return None
    try:
        return json.loads(TRIGGER_EVENT_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def upload_status() -> dict:
    datasets = []
    for dataset, filename in FILE_NAMES.items():
        path = _ensure_file(filename)
        rows = 0
        columns: list[str] = []
        if path.exists():
            try:
                df = load_local(filename)
                rows = len(df)
                columns = df.columns.tolist()
            except Exception:
                rows = 0
        datasets.append({
            "dataset": dataset,
            "label": DATASET_LABELS.get(dataset, dataset),
            "filename": filename,
            "exists": path.exists(),
            "rows": rows,
            "columns": columns,
        })
    return {
        "data_source": DATA_SOURCE,
        "datasets": datasets,
        "last_upload": latest_upload_manifest(),
        "last_trigger": latest_po_trigger(),
    }

# ============================================================
# LOCAL LOADER — reads from local machine path
# ============================================================
def load_local(filename: str) -> pd.DataFrame:
    path = _ensure_file(filename)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    df = pd.read_excel(path)
    df = _normalize_df(df)
    dataset_name = FILE_NAME_TO_DATASET.get(filename)
    if dataset_name:
        df = _enforce_schema(df, dataset_name)
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
# BUSINESS CENTRAL LOADER — delegated user_impersonation token
# ============================================================
def load_bc_items() -> pd.DataFrame:
    from bc_client import get_bc_client

    client = get_bc_client()
    df = _normalize_df(client.fetch_items_df())
    return _enforce_schema(df, "item_master")


def load_bc_purchase_lines() -> pd.DataFrame:
    from bc_client import get_bc_client

    client = get_bc_client()
    df = _normalize_df(client.fetch_purchase_order_lines_df())
    return _enforce_schema(df, "po_file")


def load_bc_code_mapping_fallback() -> pd.DataFrame:
    """Code mappings are usually custom; fall back to local Excel when present."""
    path = _ensure_file(FILE_NAMES["code_mapping"])
    if path.exists():
        return load_local(FILE_NAMES["code_mapping"])
    return _normalize_df(
        pd.DataFrame(
            columns=SCHEMAS["code_mapping"]
        )
    )

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
    elif DATA_SOURCE == "bc":
        return load_bc_code_mapping_fallback()
    else:
        raise ValueError(f"Unknown DATA_SOURCE: '{DATA_SOURCE}'. Expected 'local', 'sharepoint', or 'bc'.")

def get_po_lines() -> pd.DataFrame:
    if DATA_SOURCE == "local":
        return load_local(FILE_NAMES["po_file"])
    elif DATA_SOURCE == "sharepoint":
        return load_sharepoint(FILE_NAMES["po_file"])
    elif DATA_SOURCE == "bc":
        return load_bc_purchase_lines()
    else:
        raise ValueError(f"Unknown DATA_SOURCE: '{DATA_SOURCE}'. Expected 'local', 'sharepoint', or 'bc'.")
