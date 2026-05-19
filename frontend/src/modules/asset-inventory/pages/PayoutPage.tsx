import AssetTable, { type AssetRow } from "../components/AssetTable";

// TODO: replace with API data once /api/assets?location=payout exists
const payoutAssets: AssetRow[] = [
    {
        id: 1,
        itemDescription: "Cash Counting Machine",
        type: "Equipment",
        serialNumber: "PYO-CASH-014",
        department: "Payout",
        space: "CDO",
        datePurchase: "2024-01-22",
        vendor: "ACA Threshold Inc.",
        purchasePrice: 28500,
        warrantyDate: "2026-01-22",
        quantity: 1,
        discount: 0,
        assetValue: 28500,
        totalValue: 28500,
        color: "#1F2937",
    },
    {
        id: 2,
        itemDescription: "Teller Counter Booth",
        type: "Furniture",
        serialNumber: "PYO-CTR-022",
        department: "Payout",
        space: "WEST",
        datePurchase: "2023-11-09",
        vendor: "Custom Cabinetry Co.",
        purchasePrice: 36000,
        warrantyDate: "2025-11-09",
        quantity: 2,
        discount: 2500,
        assetValue: 33500,
        totalValue: 67000,
        color: "#9CA3AF",
        remarks: "Includes acrylic divider",
    },
];

export default function PayoutPage() {
    return (
        <AssetTable
            title="Payout Station Assets"
            description="All assets across CDO, WEST, and EAST payout stations."
            rows={payoutAssets}
        />
    );
}
