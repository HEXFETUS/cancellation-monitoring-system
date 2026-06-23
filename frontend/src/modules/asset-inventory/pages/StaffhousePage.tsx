import type { RefObject } from "react";
import AssetLocationPage from "../components/AssetLocationPage";

interface StaffhousePageProps {
    externalSearch?: string;
    onAddRef?: RefObject<() => void>;
}

export default function StaffhousePage({
    externalSearch = "",
    onAddRef,
}: StaffhousePageProps) {
    return (
        <AssetLocationPage
            location="staffhouse"
            title="Staffhouse Assets"
            description="All assets located in the Staffhouse."
            externalSearch={externalSearch}
            onAddRef={onAddRef}
        />
    );
}