# BC365 PO Validator — v2.0

A React + FastAPI application for validating Business Central 365 Purchase Orders,
with Microsoft 365 SSO login, light/dark theme, and live BC API integration.

---

## What's new in v2.0

- **Microsoft login** — MSAL-based SSO, verifies Azure AD tokens on the backend
- **Light / Dark theme** — toggle in the sidebar or top bar, persists across sessions
- **Better UX** — pass rate stat, search filter on validation results, empty states
- **Secure API** — all endpoints verify the Microsoft JWT (auto-bypassed for local dev)

---

## Quick start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> Works immediately with `DATA_SOURCE = "local"` — no Azure needed yet.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env     # fill in Azure IDs when ready
npm run dev
```

Opens at `http://localhost:5173`.

---

## Microsoft Login setup

### Register an Azure App

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps) → **New registration**
2. Name: `BC365 PO Validator`
3. Supported account types: **Accounts in this organizational directory only**
4. Redirect URI: **Single-page application (SPA)** → `http://localhost:5173`
5. Click **Register**

### Configure

Copy from the App Overview page:

| Setting | Location | Paste into |
|---|---|---|
| Application (client) ID | App overview | `frontend/.env` → `VITE_AZURE_CLIENT_ID` |
| Directory (tenant) ID | App overview | `frontend/.env` → `VITE_AZURE_TENANT_ID` |
| Client Secret | Certificates & Secrets → New secret | `backend/config.py` → `AZURE["client_secret"]` |

Also in `backend/config.py`:
```python
AZURE = {
    "tenant_id":     "your-tenant-id",
    "client_id":     "your-client-id",
    "client_secret": "your-client-secret",
}
```

### API Permissions (App Registration → API permissions → Add)

| Permission | Type | Why |
|---|---|---|
| `User.Read` | Delegated | Read signed-in user profile |
| `Files.Read.All` | Delegated | SharePoint file access |
| `https://api.businesscentral.dynamics.com/user_impersonation` | Delegated | BC365 live data |

Click **Grant admin consent**.

### Local dev without Azure

If `AZURE["client_id"]` is `"YOUR_CLIENT_ID"`, the backend skips token verification
and returns a "Local Developer" user. The login page will still show but can be bypassed
by commenting out the auth check in `App.jsx` during development.

---

## Switching data sources

Edit `backend/config.py`:

```python
DATA_SOURCE = "local"       # reads Excel files from LOCAL_DATA_PATH
DATA_SOURCE = "sharepoint"  # reads from SharePoint (needs Azure credentials)
DATA_SOURCE = "bc"          # reads live from Business Central API
```

---

## File structure

```
backend/
  main.py          — FastAPI app with MS token verification
  config.py        — Azure, SharePoint, BC settings
  data_loader.py   — Local / SharePoint / BC data loaders
  requirements.txt

frontend/
  src/
    context/
      AuthContext.jsx   — MSAL login / logout / token refresh
      ThemeContext.jsx  — Light/dark theme with localStorage persistence
    components/
      Login.jsx / .css  — Microsoft SSO login page
      Sidebar.jsx / .css
      TopBar.jsx / .css
    modules/
      validation/       — Run, History, Settings tabs
      purchasing/       — PO Lines, Vendors, Approvals, Reports
      inventory/        — Stock, Items, Warehouses, Transfers
      finance/          — Ledger, Payables, Receivables, Bank
      settings/         — Connections, Azure, BC365
  .env.example
  package.json
  vite.config.js
```