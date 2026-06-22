import type { RefObject } from "react";
import AssetLocationPage from "../components/AssetLocationPage";

interface PayoutPageProps {
    externalSearch?: string;
    onAddRef?: RefObject<() => void>;
    manageStationsOpen?: boolean;
    onManageStationsClose?: () => void;
}

export default function PayoutPage({
    externalSearch = "",
    onAddRef,
    manageStationsOpen = false,
    onManageStationsClose,
}: PayoutPageProps) {
    return (
        <AssetLocationPage
            location="payout"
            title="Payout Station Assets"
            description="All assets across CDO, WEST, and EAST payout stations."
            externalSearch={externalSearch}
            onAddRef={onAddRef}
            manageStationsOpen={manageStationsOpen}
            onManageStationsClose={onManageStationsClose}
        />
    );
}