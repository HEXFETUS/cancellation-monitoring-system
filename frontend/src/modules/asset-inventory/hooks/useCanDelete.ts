import { useAuth } from "../../../context/AuthContext";

/**
 * Whether the current user is allowed to perform delete actions.
 * Purchasers are read-write but never read-delete.
 */
export function useCanDelete(): boolean {
    const { user } = useAuth();
    return user?.usertype !== "purchaser";
}
