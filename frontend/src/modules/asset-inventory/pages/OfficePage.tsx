import AssetTable, { type AssetRow } from "../components/AssetTable";

// TODO: replace with API data once /api/assets?location=office exists
const officeAssets: AssetRow[] = [
    {
        id: 1,
        itemDescription: "Executive Office Desk",
        type: "Furniture",
        serialNumber: "OFC-DSK-001",
        department: "OPS/Admin",
        space: "Main Office",
        datePurchase: "2024-03-12",
        vendor: "Wilcon Depot",
        purchasePrice: 18500,
        warrantyDate: "2026-03-12",
        quantity: 2,
        discount: 1500,
        assetValue: 17000,
        totalValue: 34000,
        color: "#8B5A2B",
        remarks: "Mahogany finish",
    },
    {
        id: 2,
        itemDescription: "Conference Table",
        type: "Furniture",
        serialNumber: "OFC-CONF-007",
        department: "Conference",
        space: "Main Office",
        datePurchase: "2023-08-04",
        vendor: "Mandaue Foam",
        purchasePrice: 42000,
        warrantyDate: "2025-08-04",
        quantity: 1,
        discount: 0,
        assetValue: 42000,
        totalValue: 42000,
        color: "#3E3E3E",
    },
];

export default function OfficePage() {
    return (
        <AssetTable
            title="Office Assets"
            description="All assets located in the Main Office and its sub-areas."
            rows={officeAssets}
        />
    );
}
