import type { RefObject } from "react";
import AssetLocationPage from "../components/AssetLocationPage";

interface VehiclePageProps {
    externalSearch?: string;
    onAddRef?: RefObject<() => void>;
}

export default function VehiclePage({
    externalSearch = "",
    onAddRef,
}: VehiclePageProps) {
    return (
        <AssetLocationPage
            type="Vehicle"
            title="Vehicle Assets"
            description="All vehicle assets managed by the organization."
            externalSearch={externalSearch}
            onAddRef={onAddRef}
        />
    );
}