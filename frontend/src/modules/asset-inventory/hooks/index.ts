import { useCallback, useEffect, useState } from "react";
import {
    type AssetInput,
    type AssetLocation,
    createAsset,
    deleteAsset as deleteAssetApi,
    listAssets,
    updateAsset as updateAssetApi,
} from "../services";
import type { AssetRow } from "../components/AssetTable";

interface UseAssetsResult {
    rows: AssetRow[];
    loading: boolean;
    error: string;
    refresh: () => Promise<void>;
    addAsset: (input: Omit<AssetInput, "location">) => Promise<void>;
    updateAsset: (id: number, input: Omit<AssetInput, "location">) => Promise<void>;
    deleteAsset: (id: number) => Promise<void>;
}

export function useAssets(location?: AssetLocation, type?: string): UseAssetsResult {
    const [rows, setRows] = useState<AssetRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const data = await listAssets(location, type);
            setRows(data);
        } catch (err) {
            setError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Could not load assets");
        } finally {
            setLoading(false);
        }
    }, [location, type]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const addAsset = useCallback(
        async (input: Omit<AssetInput, "location">) => {
            await createAsset({ ...input, location: location ?? "office" });
            await refresh();
        },
        [location, refresh]
    );

    const updateAsset = useCallback(
        async (id: number, input: Omit<AssetInput, "location">) => {
            await updateAssetApi(id, { ...input, location: location ?? "office" });
            await refresh();
        },
        [location, refresh]
    );

    const deleteAsset = useCallback(
        async (id: number) => {
            await deleteAssetApi(id);
            await refresh();
        },
        [refresh]
    );

    return { rows, loading, error, refresh, addAsset, updateAsset, deleteAsset };
}
