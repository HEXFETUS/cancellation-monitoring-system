import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { AssetRow } from "./AssetTable";
import type { PayoutStation } from "../services/payoutStations";
import type { OfficeDepartment } from "../services/officeDepartments";

export type AssetFormValues = Omit<AssetRow, "id" | "totalValue">;

interface AssetFormModalProps {
    open: boolean;
    title: string;
    initial?: AssetRow | null;
    /** Pass when the form is for a payout asset; renders a station dropdown. */
    payoutStations?: PayoutStation[];
    /** Pass when the form is for an office asset; renders a department dropdown. */
    officeDepartments?: OfficeDepartment[];
    onClose: () => void;
    onSubmit: (values: AssetFormValues) => Promise<void>;
}

const EMPTY: AssetFormValues = {
    itemDescription: "",
    type: "",
    serialNumber: "",
    department: "",
    space: "",
    datePurchase: "",
    vendor: "",
    purchasePrice: 0,
    warrantyDate: "",
    quantity: 1,
    discount: 0,
    assetValue: 0,
    color: "#92C7CF",
    remarks: "",
    payoutStationId: null,
    officeDepartmentId: null,
};

export default function AssetFormModal({
    open,
    title,
    initial,
    payoutStations,
    officeDepartments,
    onClose,
    onSubmit,
}: AssetFormModalProps) {
    const [values, setValues] = useState<AssetFormValues>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setValues(
                initial
                    ? {
                        itemDescription: initial.itemDescription,
                        type: initial.type,
                        serialNumber: initial.serialNumber,
                        department: initial.department,
                        space: initial.space,
                        datePurchase: initial.datePurchase,
                        vendor: initial.vendor,
                        purchasePrice: initial.purchasePrice,
                        warrantyDate: initial.warrantyDate,
                        quantity: initial.quantity,
                        discount: initial.discount,
                        assetValue: initial.assetValue,
                        color: initial.color,
                        remarks: initial.remarks ?? "",
                        payoutStationId: initial.payoutStationId ?? null,
                        officeDepartmentId: initial.officeDepartmentId ?? null,
                    }
                    : EMPTY
            );
            setError("");
        }
    }, [open, initial]);

    if (!open) return null;

    // Auto-derive asset value when purchase price or discount changes (only if user hasn't overridden it).
    const computedAssetValue = Math.max(
        0,
        Number(values.purchasePrice || 0) - Number(values.discount || 0)
    );
    const computedTotalValue = Number(values.assetValue || 0) * Number(values.quantity || 1);

    const setField = <K extends keyof AssetFormValues>(
        key: K,
        value: AssetFormValues[K]
    ) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!values.itemDescription.trim()) {
            setError("Item description is required");
            return;
        }
        setSaving(true);
        setError("");
        try {
            await onSubmit(values);
            onClose();
        } catch (err: any) {
            setError(err.message || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-warm bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-warm px-6 py-4">
                    <h3 className="text-lg font-semibold text-ink">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-ink-subtle transition hover:bg-cream hover:text-ink"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5"
                >
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Item Description *">
                            <Input
                                value={values.itemDescription}
                                onChange={(v) => setField("itemDescription", v)}
                                required
                            />
                        </Field>
                        <Field label="Type">
                            <Input
                                value={values.type}
                                onChange={(v) => setField("type", v)}
                                placeholder="e.g. Furniture, Electronics"
                            />
                        </Field>

                        <Field label="Serial Number">
                            <Input
                                value={values.serialNumber}
                                onChange={(v) => setField("serialNumber", v)}
                            />
                        </Field>
                        {payoutStations ? (
                            <Field label="Payout Station *">
                                <select
                                    value={values.payoutStationId ?? ""}
                                    onChange={(e) => {
                                        const id = e.target.value === "" ? null : Number(e.target.value);
                                        setField("payoutStationId", id);
                                        const station = payoutStations.find((s) => s.id === id);
                                        // Mirror to space + department so item codes and exports stay consistent.
                                        setField("space", station?.stationCode ?? "");
                                        setField("department", station?.name ?? "");
                                    }}
                                    className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                                >
                                    <option value="">Pick a station</option>
                                    {payoutStations
                                        .filter((s) => s.active || s.id === values.payoutStationId)
                                        .map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.stationCode === s.name
                                                    ? s.name
                                                    : `${s.stationCode} — ${s.name}`}
                                                {!s.active ? " (inactive)" : ""}
                                            </option>
                                        ))}
                                </select>
                            </Field>
                        ) : officeDepartments ? (
                            <Field label="Department *">
                                <select
                                    value={values.officeDepartmentId ?? ""}
                                    onChange={(e) => {
                                        const id = e.target.value === "" ? null : Number(e.target.value);
                                        setField("officeDepartmentId", id);
                                        const dept = officeDepartments.find((d) => d.id === id);
                                        // Mirror name into `department`, but leave `space` alone — it's
                                        // a physical location (Showroom/Conference/etc.), not a role.
                                        setField("department", dept?.name ?? "");
                                    }}
                                    className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                                >
                                    <option value="">Pick a department</option>
                                    {officeDepartments
                                        .filter((d) => d.active || d.id === values.officeDepartmentId)
                                        .map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.deptCode === d.name
                                                    ? d.name
                                                    : `${d.deptCode} — ${d.name}`}
                                                {!d.active ? " (inactive)" : ""}
                                            </option>
                                        ))}
                                </select>
                            </Field>
                        ) : (
                            <Field label="Department">
                                <Input
                                    value={values.department}
                                    onChange={(v) => setField("department", v)}
                                />
                            </Field>
                        )}

                        {!payoutStations && !officeDepartments && (
                            <Field label="Space">
                                <Input
                                    value={values.space}
                                    onChange={(v) => setField("space", v)}
                                />
                            </Field>
                        )}
                        {officeDepartments && (
                            <Field label="Space (location)">
                                <Input
                                    value={values.space}
                                    onChange={(v) => setField("space", v)}
                                    placeholder="e.g. Showroom, Conference, Reception"
                                />
                            </Field>
                        )}
                        <Field label="Vendor">
                            <Input
                                value={values.vendor}
                                onChange={(v) => setField("vendor", v)}
                            />
                        </Field>

                        <Field label="Date Purchased">
                            <Input
                                type="date"
                                value={values.datePurchase}
                                onChange={(v) => setField("datePurchase", v)}
                            />
                        </Field>
                        <Field label="Warranty Date">
                            <Input
                                type="date"
                                value={values.warrantyDate}
                                onChange={(v) => setField("warrantyDate", v)}
                            />
                        </Field>

                        <Field label="Purchase Price (₱)">
                            <Input
                                type="number"
                                value={String(values.purchasePrice)}
                                onChange={(v) =>
                                    setField("purchasePrice", v === "" ? 0 : Number(v))
                                }
                                step="0.01"
                                min="0"
                            />
                        </Field>
                        <Field label="Discount (₱)">
                            <Input
                                type="number"
                                value={String(values.discount)}
                                onChange={(v) =>
                                    setField("discount", v === "" ? 0 : Number(v))
                                }
                                step="0.01"
                                min="0"
                            />
                        </Field>

                        <Field
                            label={`Asset Value (₱) — auto: ${computedAssetValue.toLocaleString()}`}
                        >
                            <Input
                                type="number"
                                value={String(values.assetValue)}
                                onChange={(v) =>
                                    setField("assetValue", v === "" ? 0 : Number(v))
                                }
                                step="0.01"
                                min="0"
                            />
                        </Field>
                        <Field label="Quantity">
                            <Input
                                type="number"
                                value={String(values.quantity)}
                                onChange={(v) =>
                                    setField("quantity", v === "" ? 1 : Math.max(1, Number(v)))
                                }
                                min="1"
                            />
                        </Field>

                        <Field label="Color">
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={values.color || "#92C7CF"}
                                    onChange={(e) => setField("color", e.target.value)}
                                    className="h-10 w-12 cursor-pointer rounded-lg border border-warm bg-card"
                                />
                                <Input
                                    value={values.color}
                                    onChange={(v) => setField("color", v)}
                                />
                            </div>
                        </Field>

                        <Field label={`Total Value: ₱${computedTotalValue.toLocaleString()}`}>
                            <div className="rounded-lg border border-dashed border-warm bg-cream px-3 py-2 text-sm text-ink-muted">
                                auto-calculated as Asset Value × Quantity
                            </div>
                        </Field>
                    </div>

                    <Field label="Remarks">
                        <textarea
                            value={values.remarks ?? ""}
                            onChange={(e) => setField("remarks", e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                        />
                    </Field>
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
                        type="submit"
                        onClick={handleSubmit}
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

/* ---------------- helpers ---------------- */

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
    type = "text",
    placeholder,
    required,
    step,
    min,
}: {
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
    step?: string;
    min?: string;
}) {
    return (
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            step={step}
            min={min}
            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
        />
    );
}
