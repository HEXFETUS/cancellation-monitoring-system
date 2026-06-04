import ConfirmationModal from "../../../shared/components/ConfirmationModal";
import type { ConfirmationModalProps } from "../../../shared/components/ConfirmationModal";

type RepairConfirmationModalProps = Omit<ConfirmationModalProps, "isLoading"> & {
    loading?: boolean;
    isLoading?: boolean;
};

export default function RepairConfirmationModal({
    loading,
    isLoading,
    ...props
}: RepairConfirmationModalProps) {
    return <ConfirmationModal {...props} isLoading={isLoading ?? loading} />;
}
