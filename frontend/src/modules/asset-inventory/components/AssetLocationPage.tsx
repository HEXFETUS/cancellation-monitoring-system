import { useState } from "react";
import AssetTable, { type AssetRow } from "./AssetTable";
import AssetFormModal, { type AssetFormValues } from "./AssetFormModal";
import { useAssets } from "../hooks";
import type { AssetLocation } from "../services";

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
    const { rows, loading, error, addAsset, updateAsset, deleteAsset } =
        useAssets(location);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AssetRow | null>(null);

    const handleAdd = () => {
        setEditing(null);
        setModalOpen(true);
    };

    const handleEdit = (row: AssetRow) => {
        setEditing(row);
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
        if (editing) {
            await updateAsset(Number(editing.id), values);
        } else {
            await addAsset(values);
        }
    };

    return (
        <>
            <AssetTable
                title={title}
                description={description}
                rows={rows}
                loading={loading}
                error={error}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            <AssetFormModal
                open={modalOpen}
                title={editing ? "Edit Asset" : "Add Asset"}
                initial={editing}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
            />
        </>
    );
}
