"""Business Central OData client using delegated user_impersonation tokens."""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd
import requests

from bc_context import get_bc_access_token
from config import AZURE, BC

logger = logging.getLogger(__name__)

BC_SCOPE_HOST = "https://api.businesscentral.dynamics.com"


class BusinessCentralError(Exception):
    pass


class BusinessCentralClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.tenant_id = AZURE.get("tenant_id") or ""
        self.environment = BC.get("environment") or "production"
        self.company_name = BC.get("company_name") or ""
        self._company_id: str | None = None

        if not self.tenant_id:
            raise BusinessCentralError("AZURE_TENANT_ID is not configured on the server.")

    @property
    def api_root(self) -> str:
        return f"{BC['base_url']}/{self.tenant_id}/{self.environment}/api/v2.0"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    def _get_paginated(self, path: str, params: dict | None = None) -> list[dict]:
        url = f"{self.api_root}{path}"
        items: list[dict] = []
        while url:
            response = requests.get(url, headers=self._headers(), params=params, timeout=60)
            if response.status_code == 401:
                raise BusinessCentralError(
                    "Business Central rejected the access token. Sign out and sign in again."
                )
            if response.status_code == 403:
                raise BusinessCentralError(
                    "Business Central permission denied. Ensure user_impersonation is granted with admin consent."
                )
            if not response.ok:
                raise BusinessCentralError(
                    f"Business Central API error {response.status_code}: {response.text[:500]}"
                )
            payload = response.json()
            items.extend(payload.get("value", []))
            url = payload.get("@odata.nextLink")
            params = None
        return items

    def company_id(self) -> str:
        if self._company_id:
            return self._company_id

        companies = self._get_paginated("/companies")
        if not companies:
            raise BusinessCentralError("No companies were returned from Business Central.")

        target = (self.company_name or "").strip()
        if target and target != "YOUR_COMPANY_NAME":
            for company in companies:
                if company.get("name") == target or company.get("displayName") == target:
                    self._company_id = company["id"]
                    return self._company_id
            names = [c.get("displayName") or c.get("name") for c in companies]
            raise BusinessCentralError(
                f"Company '{target}' was not found. Available companies: {', '.join(names)}"
            )

        self._company_id = companies[0]["id"]
        logger.info("Using default BC company: %s", companies[0].get("displayName") or companies[0].get("name"))
        return self._company_id

    def fetch_items_df(self) -> pd.DataFrame:
        company_id = self.company_id()
        raw_items = self._get_paginated(f"/companies({company_id})/items")

        rows = []
        for item in raw_items:
            rows.append({
                "Item Code": item.get("number", ""),
                "Item Description": item.get("displayName", ""),
                "Category": item.get("itemCategoryCode") or item.get("inventoryPostingGroup") or "",
                "Unit of Measure": item.get("baseUnitOfMeasureCode") or "",
                "Unit Price (USD)": _num(item.get("unitPrice")),
                "Status": "Inactive" if item.get("blocked") else "Active",
                "Last Updated": _date(item.get("lastModifiedDateTime")),
            })

        return pd.DataFrame(rows)

    def fetch_purchase_order_lines_df(self) -> pd.DataFrame:
        company_id = self.company_id()
        orders = self._get_paginated(
            f"/companies({company_id})/purchaseOrders",
            params={"$expand": "purchaseOrderLines"},
        )

        rows: list[dict[str, Any]] = []
        for order in orders:
            po_number = order.get("number", "")
            po_date = _date(order.get("orderDate"))
            vendor = order.get("vendorName") or order.get("buyFromVendorNumber") or ""
            lines = order.get("purchaseOrderLines") or []

            if isinstance(lines, dict):
                lines = lines.get("value", [])

            for line in lines:
                if line.get("lineType") not in (None, "Item", "item"):
                    continue
                qty = _num(line.get("quantity"))
                unit_price = _num(line.get("directUnitCost") or line.get("unitCost"))
                total = _num(line.get("amountExcludingTax") or line.get("lineAmount"))
                if not total and qty and unit_price:
                    total = round(qty * unit_price, 2)

                rows.append({
                    "PO Number": po_number,
                    "PO Date": po_date,
                    "Vendor": vendor,
                    "Line #": line.get("sequence") or line.get("lineNumber") or "",
                    "Item Code": line.get("number", ""),
                    "Description": line.get("description", ""),
                    "Qty": qty,
                    "Unit": line.get("unitOfMeasureCode") or "",
                    "Unit Price (USD)": unit_price,
                    "Total (USD)": total,
                })

        return pd.DataFrame(rows)


def get_bc_client() -> BusinessCentralClient:
    token = get_bc_access_token()
    if not token:
        raise BusinessCentralError(
            "Business Central access token missing. "
            "Sign in with Microsoft and ensure user_impersonation permission is granted."
        )
    return BusinessCentralClient(token)


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _date(value: Any) -> str:
    if not value:
        return ""
    return str(value)[:10]
