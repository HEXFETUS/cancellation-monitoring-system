import type { RefObject } from "react";
import AssetLocationPage from "../components/AssetLocationPage";

interface OfficePageProps {
    externalSearch?: string;
    onAddRef?: RefObject<() => void>;
    manageDeptsOpen?: boolean;
    onManageDeptsClose?: () => void;
}

export default function OfficePage({
    externalSearch = "",
    onAddRef,
    manageDeptsOpen = false,
    onManageDeptsClose,
}: OfficePageProps) {
    return (
        <AssetLocationPage
            location="office"
            title="Office Assets"
            description="All assets located in the Main Office and its sub-areas."
            externalSearch={externalSearch}
            onAddRef={onAddRef}
            manageDeptsOpen={manageDeptsOpen}
            onManageDeptsClose={onManageDeptsClose}
        />
    );
}