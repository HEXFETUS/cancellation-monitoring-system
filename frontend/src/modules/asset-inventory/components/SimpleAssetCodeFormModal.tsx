import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
    type AssetCode,
    type AssetCodeInput,
} from "../services/assetCodes";

interface Props {
    open: boolean;
    initial?: AssetCode | null;
    onClose: () => void;
    onSubmit: (values: AssetCodeInput) => Promise<void>;
}

const EMPTY: AssetCodeInput = {
    itemCode: "",
    description: "",
    type: "",
    department: "OBS",
    careOf: "",
    space: "",
    assetId: null,
};

export default function SimpleAssetCodeFormModal({ open, initial, onClose, onSubmit }: Props) {
    const [v, setV] = useState<AssetCodeInput>(EMPTY);
    const [err, setErr] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setErr("");
        if (initial) {
            setV({
                itemCode: initial.itemCode,
                description: initial.description,
                type: initial.type,
                department: initial.department,
                careOf: initial.careOf,
                space: initial.space,
                assetId: initial.assetId,
            });
        } else {
            setV(EMPTY);
        }
    }, [open, initial]);

    const set = <K extends keyof AssetCodeInput>(k: K, val: AssetCodeInput[K]) =>
        setV((prev) => ({ ...prev, [k]: val }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!v.itemCode.trim() || !v.description.trim()) {
            setErr("Item code and description are required");
            return;
        }
        setSaving(true);
        setErr("");
        try {
            await onSubmit(v);
            onClose();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 pb-8">
            <div className="w-full max-w-lg rounded-2xl border border-warm bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-warm px-6 py-4">
                    <h3 className="text-lg font-semibold text-ink">
                        {initial ? "Edit Asset" : "Add Asset"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-ink-subtle transition hover:bg-cream hover:text-ink"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-5 px-6 py-5">
                    {err && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {err}
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Item Code *">
                            <Input
                                value={v.itemCode}
                                onChange={(s) => set("itemCode", s)}
                                placeholder="e.g. OBS-001"
                                required
                            />
                        </Field>
                        <Field label="Description *">
                            <Input
                                value={v.description}
                                onChange={(s) => set("description", s)}
                                required
                            />
                        </Field>
                        <Field label="Type">
                            <Input value={v.type} onChange={(s) => set("type", s)} />
                        </Field>
                        <Field label="Department">
                            <Input
                                value={v.department}
                                onChange={(s) => set("department", s)}
                            />
                        </Field>
                        <Field label="Care Of">
                            <Input value={v.careOf} onChange={(s) => set("careOf", s)} />
                        </Field>
                        <Field label="Space">
                            <Input value={v.space} onChange={(s) => set("space", s)} />
                        </Field>
                    </div>
                </form>

                <div className="flex justify-end gap-3 border-t border-warm bg-cream px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={saving}
                        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
            </span>
            {children}
        </label>
    );
}

function Input({
    value,
    onChange,
    placeholder,
    required,
}: {
    value: string;
    onChange: (s: string) => void;
    placeholder?: string;
    required?: boolean;
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
        />
    );
}