import type { RefObject } from "react";
import AssetLocationPage from "../components/AssetLocationPage";

interface DrawcourtPageProps {
    externalSearch?: string;
    onAddRef?: RefObject<() => void>;
}

export default function DrawcourtPage({
    externalSearch = "",
    onAddRef,
}: DrawcourtPageProps) {
    return (
        <AssetLocationPage
            location="drawcourt"
            title="Drawcourt Assets"
            description="All assets located in the Drawcourt area."
            externalSearch={externalSearch}
            onAddRef={onAddRef}
        />
    );
}