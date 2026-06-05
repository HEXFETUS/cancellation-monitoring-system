import ConfirmationModal from "../../../shared/components/ConfirmationModal";
import type { ConfirmationModalProps } from "../../../shared/components/ConfirmationModal";

type CsrConfirmationModalProps = Omit<ConfirmationModalProps, "isLoading"> & {
    loading?: boolean;
    isLoading?: boolean;
};

export default function CsrConfirmationModal({
    loading,
    isLoading,
    ...props
}: CsrConfirmationModalProps) {
    return <ConfirmationModal {...props} isLoading={isLoading ?? loading} />;
}
