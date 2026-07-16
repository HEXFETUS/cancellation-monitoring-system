import { useEffect, useState, useRef, type RefObject } from "react";
import { Settings2 } from "lucide-react";
import AssetTable, { type AssetRow } from "./AssetTable";
import AssetFormModal, { type AssetFormValues } from "./AssetFormModal";
import AssetDetailsModal from "./AssetDetailsModal";
import PayoutStationsModal from "./PayoutStationsModal";
import OfficeDepartmentsModal from "./OfficeDepartmentsModal";
import { useAssets } from "../hooks";
import ConfirmationModal from "../../../shared/components/ConfirmationModal";
import { useCanDelete } from "../hooks/useCanDelete";
import type { AssetLocation } from "../services";
import {
    listPayoutStations,
    type PayoutStation,
} from "../services/payoutStations";
import {
    listOfficeDepartments,
    type OfficeDepartment,
} from "../services/officeDepartments";

interface AssetLocationPageProps {
    location?: AssetLocation;
    type?: string;
    title: string;
    description?: string;
    /** External search value from the parent (tabs row). */
    externalSearch?: string;
    /** Ref to expose the add handler to the parent. */
    onAddRef?: RefObject<() => void>;
    /** Whether the Manage Departments modal should be open (controlled from parent). */
    manageDeptsOpen?: boolean;
    /** Called when Manage Departments modal is closed. */
    onManageDeptsClose?: () => void;
    /** Whether the Manage Stations modal should be open (controlled from parent). */
    manageStationsOpen?: boolean;
    /** Called when Manage Stations modal is closed. */
    onManageStationsClose?: () => void;
}

export default function AssetLocationPage({
    location,
    type,
    title,
    description,
    externalSearch,
    onAddRef,
    manageDeptsOpen: externalDeptsOpen,
    onManageDeptsClose,
    manageStationsOpen: externalStationsOpen,
    onManageStationsClose,
}: AssetLocationPageProps) {
    const { rows, loading, error, addAsset, updateAsset, deleteAsset, refresh } =
        useAssets(location, type);
    const canDelete = useCanDelete();

    const isPayout = location === "payout";
    const isOffice = location === "office";

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AssetRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AssetRow | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsAsset, setDetailsAsset] = useState<AssetRow | null>(null);

    // Internal state for modals (used when not externally controlled)
    const [internalStationsOpen, setInternalStationsOpen] = useState(false);
    const [internalDeptsOpen, setInternalDeptsOpen] = useState(false);

    // Determine if modals are externally controlled
    const stationsOpen = externalStationsOpen !== undefined ? externalStationsOpen : internalStationsOpen;
    const deptsOpen = externalDeptsOpen !== undefined ? externalDeptsOpen : internalDeptsOpen;

    const setStationsOpen = externalStationsOpen !== undefined
        ? (v: boolean) => { if (!v && onManageStationsClose) onManageStationsClose(); }
        : setInternalStationsOpen;
    const setDeptsOpen = externalDeptsOpen !== undefined
        ? (v: boolean) => { if (!v && onManageDeptsClose) onManageDeptsClose(); }
        : setInternalDeptsOpen;

    // Payout-only state
    const [stations, setStations] = useState<PayoutStation[]>([]);
    const [stationsError, setStationsError] = useState("");

    // Office-only state
    const [departments, setDepartments] = useState<OfficeDepartment[]>([]);
    const [deptsError, setDeptsError] = useState("");

    // Internal add ref to expose
    const internalAddRef = useRef<() => void>(() => {});
    const effectiveAddRef = onAddRef || internalAddRef;

    const loadStations = async () => {
        if (!isPayout) return;
        try {
            setStationsError("");
            setStations(await listPayoutStations());
        } catch (err) {
            setStationsError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Could not load stations");
        }
    };

    const loadDepartments = async () => {
        if (!isOffice) return;
        try {
            setDeptsError("");
            setDepartments(await listOfficeDepartments());
        } catch (err) {
            setDeptsError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Could not load departments");
        }
    };

    useEffect(() => {
        loadStations();
        loadDepartments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPayout, isOffice]);

    const handleAdd = () => {
        setEditing(null);
        setModalOpen(true);
    };

    // Expose handleAdd to parent via ref
    useEffect(() => {
        if (effectiveAddRef) {
            effectiveAddRef.current = handleAdd;
        }
    });

    const handleViewDetails = (row: AssetRow) => {
        setDetailsAsset(row);
        setDetailsOpen(true);
    };

    const handleEdit = (row: AssetRow) => {
        // Use the original row (not the display version where department/space are overwritten).
        const original = rows.find((r) => r.id === row.id) ?? row;
        setEditing(original);
        setModalOpen(true);
    };

    const handleDeleteClick = (row: AssetRow) => {
        setDeleteTarget(row);
    };
    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteAsset(Number(deleteTarget.id));
            setDeleteTarget(null);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to delete");
        } finally {
            setDeleting(false);
        }
    };

    const handleSubmit = async (values: AssetFormValues) => {
        let toSave = values;

        if (isPayout) {
            const picked = stations.find((s) => s.id === values.payoutStationId);
            toSave = {
                ...values,
                department: picked ? picked.name : values.department,
                space: picked ? picked.stationCode : values.space,
            };
        } else if (isOffice) {
            const picked = departments.find((d) => d.id === values.officeDepartmentId);
            toSave = {
                ...values,
                department: picked ? picked.name : values.department,
                // Don't touch `space` — it's a physical location, not the dept code.
            };
        }

        if (editing) {
            await updateAsset(Number(editing.id), toSave);
        } else {
            await addAsset(toSave);
        }
    };

    // We hide the internal header if externalSearch is provided (controls in tabs row)
    const hideHeader = externalSearch !== undefined;

    return (
        <>
            <AssetTable
                title={title}
                description={description}
                rows={rows}
                loading={loading}
                error={error || stationsError || deptsError}
                onAdd={!hideHeader ? handleAdd : undefined}
                onViewDetails={handleViewDetails}
                hideHeader={hideHeader}
                externalSearch={hideHeader ? externalSearch : undefined}
                extraHeaderActions={
                    !hideHeader ? (
                        <>
                            {isPayout && (
                                <button
                                    onClick={() => setStationsOpen(true)}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-warm bg-card px-2.5 py-1.5 text-xs font-medium text-ink transition hover:bg-warm/40"
                                >
                                    <Settings2 size={14} />
                                    Manage Stations
                                </button>
                            )}
                            {isOffice && (
                                <button
                                    onClick={() => setDeptsOpen(true)}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-warm bg-card px-2.5 py-1.5 text-xs font-medium text-ink transition hover:bg-warm/40"
                                >
                                    <Settings2 size={14} />
                                    Manage Departments
                                </button>
                            )}
                        </>
                    ) : undefined
                }
            />

            <AssetFormModal
                open={modalOpen}
                title={editing ? "Edit Asset" : `Add Asset for ${location ? location.charAt(0).toUpperCase() + location.slice(1) : "Location"}`}
                initial={editing}
                payoutStations={isPayout ? stations : undefined}
                officeDepartments={isOffice ? departments : undefined}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
            />

            <AssetDetailsModal
                open={detailsOpen}
                asset={detailsAsset}
                onClose={() => setDetailsOpen(false)}
                onEdit={handleEdit}
                onDelete={canDelete ? handleDeleteClick : undefined}
            />

            {isPayout && (
                <PayoutStationsModal
                    open={stationsOpen}
                    stations={stations}
                    onClose={() => setStationsOpen(false)}
                    onChanged={async () => {
                        await loadStations();
                        await refresh();
                    }}
                />
            )}

            {isOffice && (
                <OfficeDepartmentsModal
                    open={deptsOpen}
                    departments={departments}
                    onClose={() => setDeptsOpen(false)}
                    onChanged={async () => {
                        await loadDepartments();
                        await refresh();
                    }}
                />
            )}

            <ConfirmationModal
                open={!!deleteTarget}
                variant="delete"
                title="Delete Asset"
                message={`Are you sure you want to delete "${deleteTarget?.itemDescription}"? This cannot be undone.`}
                confirmLabel="Yes, Delete"
                cancelLabel="Cancel"
                isLoading={deleting}
                loadingLabel="Deleting..."
                onCancel={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
            />
        </>
    );
}