import AssetTable, { type AssetRow } from "../components/AssetTable";

// TODO: replace with API data once /api/assets?location=obs exists
const obsAssets: AssetRow[] = [
    {
        id: 1,
        itemDescription: "Surveillance Camera",
        type: "Electronics",
        serialNumber: "OBS-CAM-009",
        department: "OBS",
        space: "Lobby",
        datePurchase: "2024-02-14",
        vendor: "Hikvision PH",
        purchasePrice: 8500,
        warrantyDate: "2026-02-14",
        quantity: 8,
        discount: 500,
        assetValue: 8000,
        totalValue: 64000,
        color: "#FFFFFF",
        remarks: "1080p, IR-enabled",
    },
    {
        id: 2,
        itemDescription: "DVR Recording Unit",
        type: "Electronics",
        serialNumber: "OBS-DVR-002",
        department: "OBS",
        space: "Server Room",
        datePurchase: "2024-02-14",
        vendor: "Hikvision PH",
        purchasePrice: 22500,
        warrantyDate: "2027-02-14",
        quantity: 1,
        discount: 0,
        assetValue: 22500,
        totalValue: 22500,
        color: "#000000",
        remarks: "16-channel, 4TB storage",
    },
    {
        id: 3,
        itemDescription: "Monitoring Display",
        type: "Electronics",
        serialNumber: "OBS-MON-005",
        department: "OBS",
        space: "Control Room",
        datePurchase: "2023-09-21",
        vendor: "Asianic Distributors",
        purchasePrice: 16000,
        warrantyDate: "2025-09-21",
        quantity: 2,
        discount: 1000,
        assetValue: 15000,
        totalValue: 30000,
        color: "#1F2937",
    },
];

export default function ObsPage() {
    return (
        <AssetTable
            title="OBS Assets"
            description="All surveillance and monitoring assets under the OBS department."
            rows={obsAssets}
        />
    );
}
