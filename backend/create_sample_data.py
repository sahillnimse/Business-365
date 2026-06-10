import pandas as pd
from pathlib import Path

# Resolve data directory relative to this script's location
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# Sample Item Master data
item_master_data = {
    'Item Code': ['ITEM001', 'ITEM002', 'ITEM003', 'ITEM004', 'ITEM005'],
    'Item Description': ['Laptop Computer', 'Desktop Monitor', 'Wireless Mouse', 'Keyboard', 'USB Cable'],
    'Category': ['Electronics', 'Electronics', 'Electronics', 'Electronics', 'Electronics'],
    'Status': ['Active', 'Active', 'Inactive', 'Active', 'Active'],
    'Unit of Measure': ['PCE', 'PCE', 'PCE', 'PCE', 'PCE'],
    'Standard Cost': [1200.00, 300.00, 25.00, 75.00, 5.00]
}

df_item_master = pd.DataFrame(item_master_data)
df_item_master.to_excel(DATA_DIR / 'Item_Master.xlsx', index=False)
print(f"Created: {DATA_DIR / 'Item_Master.xlsx'}")

# Sample Code Mapping data
code_mapping_data = {
    'Old Item Code': ['OLD001', 'OLD002', 'OLD003'],
    'New Item Code': ['ITEM001', 'ITEM002', 'ITEM999'],
    'Effective Date': ['2024-01-01', '2024-01-01', '2024-01-01'],
    'Reason': ['System Update', 'System Update', 'Discontinued']
}

df_code_mapping = pd.DataFrame(code_mapping_data)
df_code_mapping.to_excel(DATA_DIR / 'Code_Mapping_Table.xlsx', index=False)
print(f"Created: {DATA_DIR / 'Code_Mapping_Table.xlsx'}")

# Sample PO File data
po_data = {
    'PO Number': ['PO001', 'PO001', 'PO002', 'PO002', 'PO003'],
    'Line #': ['1', '2', '1', '2', '1'],
    'Item Code': ['ITEM001', 'ITEM999', 'ITEM002', 'ITEM003', 'ITEM999'],
    'Vendor': ['Vendor A', 'Vendor A', 'Vendor B', 'Vendor C', 'Vendor D'],
    'Qty': ['1', '2', '5', '3', '10'],
    'Unit Price (USD)': [1200.00, 15.00, 300.00, 25.00, 2.00]
}

df_po = pd.DataFrame(po_data)
df_po.to_excel(DATA_DIR / 'Sample_PO_File.xlsx', index=False)
print(f"Created: {DATA_DIR / 'Sample_PO_File.xlsx'}")