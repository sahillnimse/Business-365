# Business 365 — Purchase Order Validator Suite v2.0

A modern React (Vite) + FastAPI (Python) web application built to validate incoming Purchase Orders against an Item Master list and Code Mapping tables. It is designed to verify that item codes exist, are active, and are not duplicated or discontinued before proceeding to further business pipelines.

---

## Technical Features
* **Dual Trigger Workflows**: Interactive file uploads via the UI (Method 1) or automated external webhook triggers for Microsoft Teams / Power Automate (Method 2).
* **Microsoft SSO Login**: Secure authentication utilizing Microsoft MSAL.js in the browser, verifying token signatures in the Python backend.
* **Flexible Data Integration**: Instantly switch data sources between local Excel spreadsheets, SharePoint sites, or live Dynamics 365 Business Central APIs.
* **Premium Aesthetics**: Harmonious dark/light theme options with automatic layout adjustment, state persistence, and responsive charts.

---

## File Structure

```
PO-Validator/
├── README.md               # Main project documentation
├── backend/                # FastAPI application
│   ├── .env                # Backend secrets & configuration
│   ├── main.py             # Server endpoints & validation logic
│   ├── auth.py             # Microsoft JWT token verification
│   ├── bc_client.py        # Business Central OData API client
│   ├── bc_context.py       # Context store for BC tokens per request
│   ├── config.py           # Application constants & configurations
│   ├── requirements.txt    # Python package list
│   ├── data_loader.py      # Local Excel / SharePoint / BC loader adapters
│   ├── create_sample_data.py # Helper script to regenerate mock Excel data
│   ├── test_server.py      # Health test script
│   ├── data/               # Local Excel files database
│   │   ├── Item_Master.xlsx
│   │   ├── Code_Mapping_Table.xlsx
│   │   └── Sample_PO_File.xlsx
│   └── venv/               # Active python virtual environment
└── frontend/               # Vite React application
    ├── .env                # Frontend public configuration
    ├── package.json        # Dependencies & start scripts
    ├── vite.config.js      # Vite dev server configuration
    └── src/
        ├── main.jsx        # App entry point, routes & contexts setup
        ├── styles.css      # Core styles & styling system
        ├── components/     # AppLayout, SignInPage, UserAvatar, etc.
        ├── context/        # AuthContext.jsx (SSO, token management)
        ├── routes/         # Dashboard, Validation, CSV Upload, Finance, etc.
        └── lib/            # api.js, msal.js, theme.jsx, user.js, utils.js
```

---

## Installation & Setup

### 1. Backend Server Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Activate the virtual environment (Windows):
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create and configure your `backend/.env` file (see details below).
5. Start the FastAPI server using Uvicorn:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### 2. Frontend App Setup
1. Open a separate terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the frontend dependencies:
   ```bash
   npm install
   ```
3. Create and configure your `frontend/.env` file (see details below).
4. Launch the Vite development server:
   ```bash
   npm run dev
   ```
   *The application will open automatically at `http://localhost:8080/`.*

---

## Environment Configuration

### Frontend Settings (`frontend/.env`)
Create a `.env` file in the frontend folder with the following variables:
```env
# Backend API service URL
VITE_API_URL=http://localhost:8000

# Microsoft Azure AD registration details
VITE_AZURE_CLIENT_ID=34f6d960-09e3-47a3-9783-7ae8bac4bf46
VITE_AZURE_TENANT_ID=99096dce-9dea-4f18-b4bb-b586eea333ee
VITE_AZURE_REDIRECT_URI=http://localhost:8080
```

### Backend Settings (`backend/.env`)
Create a `.env` file in the backend folder. Note that credentials must be kept secure:
```env
# Microsoft Azure AD Server authentication details
AZURE_TENANT_ID=99096dce-9dea-4f18-b4bb-b586eea333ee
AZURE_CLIENT_ID=34f6d960-09e3-47a3-9783-7ae8bac4bf46
AZURE_CLIENT_SECRET=your-secret-here

# Local dev JWT key (any random string)
DUMMY_JWT_SECRET=change-me-in-production-use-a-long-random-string

# DATA SOURCE MODE: "local" | "sharepoint" | "bc"
DATA_SOURCE=local

# Business Central configuration (Required only when DATA_SOURCE=bc)
BC_COMPANY_NAME=My Company
BC_ENVIRONMENT=production
```

---

## Data Source Options (`DATA_SOURCE`)

You can switch the project data integration instantly by modifying `DATA_SOURCE` inside `backend/.env`:

1. **`local`**: Loads item list, code mappings, and purchase orders from spreadsheets stored inside `backend/data/` on the local disk. Excellent for development and offline demos.
2. **`bc`**: Connects directly to Microsoft Dynamics 365 Business Central API, reading active inventory items and purchase orders in real-time. Uses delegated client token permissions.
3. **`sharepoint`**: Connects and pulls spreadsheet files directly from a designated company SharePoint folder (configured inside `backend/config.py`).

---

## Trigger Methods

### Method 1: Interactive Upload (UI)
1. Go to the **CSV Upload** page on the sidebar menu.
2. Upload a `.csv` or `.xlsx` document containing your purchase order lines.
3. The system maps spreadsheet sheets/columns to inventory lines and evaluates them instantly, saving the results on the **Validation** page.

### Method 2: Webhook Trigger (Teams / Power Automate)
You can automate validation workflows by triggering the backend webhook programmatically.

* **Webhook URL**: `POST http://localhost:8000/teams/po-trigger`
* **Content-Type**: `application/json`

#### Example Trigger Payload:
```json
{
  "created_by": "sahil.nimse@yourdomain.com",
  "po_number": "PO-10024",
  "source": "teams",
  "lines": [
    {
      "PO Number": "PO-10024",
      "Line #": "1",
      "Item Code": "ITEM001",
      "Vendor": "Vendor A",
      "Qty": 5,
      "Unit Price (USD)": 1200.00
    },
    {
      "PO Number": "PO-10024",
      "Line #": "2",
      "Item Code": "ITEM001",
      "Vendor": "Vendor A",
      "Qty": 1,
      "Unit Price (USD)": 1200.00
    }
  ]
}
```

#### Webhook Response:
The API validates the payload lines directly against your active master database and returns counts along with descriptive pass/fail feedback for notifications:
```json
{
  "accepted": true,
  "event": {
    "source": "teams",
    "po_number": "PO-10024",
    "received_at": "2026-06-12T07:44:23Z",
    "lines": 2
  },
  "validation": {
    "total": 2,
    "pass": 0,
    "rejected": 2,
    "duplicate": 2,
    "missing_code": 0,
    "results": [
      {
        "po_number": "PO-10024",
        "line_num": "1",
        "vendor": "Vendor A",
        "qty": "5",
        "unit_price": "1200.0",
        "original_code": "ITEM001",
        "mapped_code": "N/A",
        "status": "REJECT-DUPLICATE",
        "message": "Item code is repeated in the uploaded document - document not passed.",
        "notification_channel": "Teams / Outlook",
        "notification_message": "Document PO-10024 rejected: item code ITEM001 is repeated in the upload."
      },
      ...
    ]
  }
}
```

---

## Troubleshooting & FAQ

### Empty Business Central Database (KeyError: 'Status')
* **Symptom**: If your selected Business Central environment or company (`BC_COMPANY_NAME`) does not have any items or purchase order lines, endpoints like `/dashboard` or `/items` would crash with `KeyError: 'Status'`.
* **Explanation**: Pandas converts empty item collections to DataFrames with no columns.
* **Resolution**: The system is fully patched to initialize empty DataFrames with standard column schemas (`"Item Code"`, `"Status"`, etc.), allowing it to load empty metrics (`0`) successfully instead of crashing.

### Blank White Screen
* **Symptom**: The browser goes completely white after signing in with Microsoft.
* **Checks**:
  1. Ensure the Python backend server is running (`http://localhost:8000/health`).
  2. Verify that `VITE_API_URL` inside `frontend/.env` is set correctly to point to your backend.
  3. Clear browser cookies and sessionStorage to reset active MSAL tokens, then refresh.
