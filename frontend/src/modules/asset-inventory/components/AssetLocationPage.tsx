import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import AssetTable, { type AssetRow } from "./AssetTable";
import AssetFormModal, { type AssetFormValues } from "./AssetFormModal";
import PayoutStationsModal from "./PayoutStationsModal";
import OfficeDepartmentsModal from "./OfficeDepartmentsModal";
import { useAssets } from "../hooks";
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
    location: AssetLocation;
    title: string;
    description?: string;
}

export default function AssetLocationPage({
    location,
    title,
    description,
}: AssetLocationPageProps) {
    const { rows, loading, error, addAsset, updateAsset, deleteAsset, refresh } =
        useAssets(location);
    const canDelete = useCanDelete();

    const isPayout = location === "payout";
    const isOffice = location === "office";

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AssetRow | null>(null);

    // Payout-only state
    const [stationsOpen, setStationsOpen] = useState(false);
    const [stations, setStations] = useState<PayoutStation[]>([]);
    const [stationsError, setStationsError] = useState("");

    // Office-only state
    const [deptsOpen, setDeptsOpen] = useState(false);
    const [departments, setDepartments] = useState<OfficeDepartment[]>([]);
    const [deptsError, setDeptsError] = useState("");

    const loadStations = async () => {
        if (!isPayout) return;
        try {
            setStationsError("");
            setStations(await listPayoutStations());
        } catch (err: any) {
            setStationsError(err.message || "Could not load stations");
        }
    };

    const loadDepartments = async () => {
        if (!isOffice) return;
        try {
            setDeptsError("");
            setDepartments(await listOfficeDepartments());
        } catch (err: any) {
            setDeptsError(err.message || "Could not load departments");
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

    const handleEdit = (row: AssetRow) => {
        // Use the original row (not the display version where department/space are overwritten).
        const original = rows.find((r) => r.id === row.id) ?? row;
        setEditing(original);
        setModalOpen(true);
    };

    const handleDelete = async (row: AssetRow) => {
        if (!confirm(`Delete "${row.itemDescription}"? This cannot be undone.`)) return;
        try {
            await deleteAsset(Number(row.id));
        } catch (err: any) {
            alert(err.message || "Failed to delete");
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

    /**
     * Replace the row's `department` field with a meaningful display string.
     * Payout → "CDO — Cagayan de Oro"
     * Office → "IT — Information Technology"
     */
    const displayRows: AssetRow[] = (() => {
        if (isPayout) {
            return rows.map((r) => {
                const station = stations.find((s) => s.id === r.payoutStationId);
                return {
                    ...r,
                    department: station?.name || r.department || "—",
                };
            });
        }
        if (isOffice) {
            return rows.map((r) => {
                const dept = departments.find((d) => d.id === r.officeDepartmentId);
                return {
                    ...r,
                    department: dept?.name || r.department || "—",
                };
            });
        }
        return rows;
    })();

    return (
        <>
            <AssetTable
                title={title}
                description={description}
                rows={displayRows}
                loading={loading}
                error={error || stationsError || deptsError}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={canDelete ? handleDelete : undefined}
                departmentLabel={
                    isPayout ? "Payout Station" : isOffice ? "Department" : undefined
                }
                extraHeaderActions={
                    <>
                        {isPayout && (
                            <button
                                onClick={() => setStationsOpen(true)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40"
                            >
                                <Settings2 size={16} />
                                Manage Stations
                            </button>
                        )}
                        {isOffice && (
                            <button
                                onClick={() => setDeptsOpen(true)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40"
                            >
                                <Settings2 size={16} />
                                Manage Departments
                            </button>
                        )}
                    </>
                }
            />

            <AssetFormModal
                open={modalOpen}
                title={editing ? "Edit Asset" : "Add Asset"}
                initial={editing}
                payoutStations={isPayout ? stations : undefined}
                officeDepartments={isOffice ? departments : undefined}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
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
        </>
    );
}
