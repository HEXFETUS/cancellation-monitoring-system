import AssetTable, { type AssetRow } from "../components/AssetTable";

// TODO: replace with API data once /api/assets?location=drawcourt exists
const drawcourtAssets: AssetRow[] = [
    {
        id: 1,
        itemDescription: "Draw Console Monitor",
        type: "Electronics",
        serialNumber: "DRW-MON-003",
        department: "Drawcourt",
        space: "Drawcourt Hall",
        datePurchase: "2024-05-18",
        vendor: "Asianic Distributors",
        purchasePrice: 19500,
        warrantyDate: "2026-05-18",
        quantity: 4,
        discount: 1000,
        assetValue: 18500,
        totalValue: 74000,
        color: "#0F172A",
    },
    {
        id: 2,
        itemDescription: "Number Drawing Machine",
        type: "Equipment",
        serialNumber: "DRW-DRW-001",
        department: "Drawcourt",
        space: "Drawcourt Hall",
        datePurchase: "2022-12-01",
        vendor: "STL Solutions",
        purchasePrice: 215000,
        warrantyDate: "2025-12-01",
        quantity: 1,
        discount: 0,
        assetValue: 215000,
        totalValue: 215000,
        color: "#DC2626",
        remarks: "Annual calibration required",
    },
];

export default function DrawcourtPage() {
    return (
        <AssetTable
            title="Drawcourt Assets"
            description="All assets located in the Drawcourt area."
            rows={drawcourtAssets}
        />
    );
}
