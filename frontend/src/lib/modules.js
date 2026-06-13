export const MODULES = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/",
    icon: "LayoutDashboard",
    tabs: [],
  },
  {
    id: "validation",
    label: "Validation",
    path: "/validation",
    icon: "ShieldCheck",
    tabs: [
      { id: "run", label: "Run" },
      { id: "history", label: "History" },
      { id: "settings", label: "Settings" },
    ],
  },
  {
    id: "upload",
    label: "CSV Upload",
    path: "/upload",
    icon: "FileSpreadsheet",
    tabs: [
      { id: "upload", label: "Upload" },
      { id: "sheets", label: "Sheets" },
      { id: "mapping", label: "Mapping" },
    ],
  },
  {
    id: "purchasing",
    label: "Purchasing",
    path: "/purchasing",
    icon: "ShoppingCart",
    tabs: [
      { id: "po-lines", label: "PO Lines" },
      { id: "vendors", label: "Vendors" },
      { id: "approvals", label: "Approvals" },
      { id: "reports", label: "Reports" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    path: "/inventory",
    icon: "Package",
    tabs: [
      { id: "stock", label: "Stock" },
      { id: "items", label: "Items" },
      { id: "warehouses", label: "Warehouses" },
      { id: "transfers", label: "Transfers" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    path: "/finance",
    icon: "Wallet",
    tabs: [
      { id: "ledger", label: "Ledger" },
      { id: "payables", label: "Payables" },
      { id: "receivables", label: "Receivables" },
      { id: "bank", label: "Bank" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    path: "/settings",
    icon: "Settings",
    tabs: [
      { id: "connections", label: "Connections" },
      { id: "azure", label: "Azure" },
      { id: "bc365", label: "BC365" },
      { id: "webhooks", label: "Webhooks" },
    ],
  },
];
