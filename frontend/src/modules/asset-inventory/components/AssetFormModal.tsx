import { useEffect, useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import type { AssetRow } from "./AssetTable";
import type { PayoutStation } from "../services/payoutStations";
import type { OfficeDepartment } from "../services/officeDepartments";
import ConfirmationModal from "../../../shared/components/ConfirmationModal";

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
    const [showConfirm, setShowConfirm] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);

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
            setShowConfirm(false);
        }
    }, [open, initial]);

    if (!open) return null;

    // Auto-derive asset value when purchase price or discount changes (only if user hasn't overridden it).
    const computedAssetValue = Math.max(
        0,
        Number(values.purchasePrice || 0) - Number(values.discount || 0)
    );
    const effectiveAssetValue =
        Number(values.assetValue || 0) > 0 ? Number(values.assetValue || 0) : computedAssetValue;
    const computedTotalValue = effectiveAssetValue * Number(values.quantity || 1);

    const setField = <K extends keyof AssetFormValues>(
        key: K,
        value: AssetFormValues[K]
    ) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    // Check if required fields are filled
    const isMissingRequired =
        !values.itemDescription.trim() ||
        (payoutStations ? values.payoutStationId === null : false) ||
        (officeDepartments ? values.officeDepartmentId === null : false) ||
        !values.datePurchase.trim() ||
        Number(values.purchasePrice) <= 0;

    // Step 1: Validate and show confirmation
    const handleSubmitClick = (e: React.FormEvent) => {
        e.preventDefault();
        if (!values.itemDescription.trim()) {
            setError("Item description is required");
            return;
        }
        if (payoutStations && values.payoutStationId === null) {
            setError("Please select a payout station");
            return;
        }
        if (officeDepartments && values.officeDepartmentId === null) {
            setError("Please select a department");
            return;
        }
        if (!values.datePurchase.trim()) {
            setError("Date purchased is required");
            return;
        }
        if (Number(values.purchasePrice) <= 0) {
            setError("Purchase price is required and must be greater than 0");
            return;
        }
        setError("");
        setShowConfirm(true);
    };

    // Step 2: Actually save after confirmation
    const handleConfirmSave = async () => {
        setSaving(true);
        setError("");
        try {
            await onSubmit({
                ...values,
                assetValue: effectiveAssetValue,
            });
            setShowConfirm(false);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
            setShowConfirm(false);
        } finally {
            setSaving(false);
        }
    };

    const effectiveDepartment =
        payoutStations?.find((s) => s.id === values.payoutStationId)?.name ||
        officeDepartments?.find((d) => d.id === values.officeDepartmentId)?.name ||
        values.department;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 pb-8">
                <div className="w-full max-w-3xl rounded-2xl border border-warm bg-card shadow-xl animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-warm px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/20">
                                <span className="text-sm font-bold text-teal-600">
                                    {initial ? "✎" : "+"}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-ink">{title}</h3>
                                {!initial && (
                                    <p className="text-xs text-ink-muted">Fill in the details below</p>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-ink-subtle transition hover:bg-cream hover:text-ink"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form
                        onSubmit={handleSubmitClick}
                        className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5"
                    >
                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        {/* Section: Basic Info */}
                        <Section title="Basic Information">
                            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Item Description" required>
                    <Input
                        value={values.itemDescription}
                        onChange={(v) => setField("itemDescription", v)}
                        required
                        placeholder="e.g. Office Chair, Laptop"
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
                                        placeholder="e.g. SN-2024-001"
                                    />
                                </Field>

                {payoutStations ? (
                    <Field label="Payout Station" required>
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
                    <Field label="Department" required>
                        <select
                            value={values.officeDepartmentId ?? ""}
                                            onChange={(e) => {
                                                const id = e.target.value === "" ? null : Number(e.target.value);
                                                setField("officeDepartmentId", id);
                                                const dept = officeDepartments.find((d) => d.id === id);
                                                // Mirror name into `department`, but leave `space` alone
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
                                            placeholder="e.g. IT Department"
                                        />
                                    </Field>
                                )}

                                {!payoutStations && !officeDepartments && (
                                    <Field label="Space">
                                        <Input
                                            value={values.space}
                                            onChange={(v) => setField("space", v)}
                                            placeholder="e.g. Room 201"
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
                                        placeholder="e.g. ABC Supplies"
                                    />
                                </Field>
                            </div>
                        </Section>

                        {/* Section: Dates */}
                        <Section title="Dates">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Date Purchased" required>
                                    <Input
                                        type="date"
                                        value={values.datePurchase}
                                        onChange={(v) => setField("datePurchase", v)}
                                        required
                                    />
                                </Field>
                                <Field label="Warranty Date">
                                    <Input
                                        type="date"
                                        value={values.warrantyDate}
                                        onChange={(v) => setField("warrantyDate", v)}
                                    />
                                </Field>
                            </div>
                        </Section>

                        {/* Section: Financials */}
                        <Section title="Financials">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Purchase Price (₱)" required>
                                    <Input
                                        type="number"
                                        value={String(values.purchasePrice)}
                                        onChange={(v) =>
                                            setField("purchasePrice", v === "" ? 0 : Number(v))
                                        }
                                        step="0.01"
                                        min="0"
                                        required
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
                                    label={`Asset Value (₱) — auto: ₱${computedAssetValue.toLocaleString()}`}
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

                                <Field label="Total Value">
                                    <div className="flex h-10 items-center rounded-lg border border-dashed border-teal/40 bg-teal/5 px-3 text-sm font-semibold text-ink">
                                        ₱{computedTotalValue.toLocaleString()}
                                        <span className="ml-2 text-xs font-normal text-ink-muted">
                                            (Asset Value × Quantity)
                                        </span>
                                    </div>
                                </Field>
                            </div>
                        </Section>

                        {/* Section: Remarks */}
                        <Section title="Remarks">
                            <textarea
                                value={values.remarks ?? ""}
                                onChange={(e) => setField("remarks", e.target.value)}
                                rows={3}
                                placeholder="Any additional notes or comments..."
                                className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            />
                        </Section>
                    </form>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-warm bg-cream px-6 py-4">
                        {initial && (
                            <button
                                type="button"
                                onClick={() => setPreviewOpen(!previewOpen)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-warm/40"
                            >
                                {previewOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                                {previewOpen ? "Hide Values" : "Show Computed Values"}
                            </button>
                        )}
                        <div className="flex items-center gap-3 ml-auto">
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
                                onClick={handleSubmitClick}
                                disabled={saving || isMissingRequired}
                                className="rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-teal-dark disabled:opacity-50 disabled:cursor-not-allowed"
                                title={isMissingRequired ? "Please fill in all required fields" : ""}
                            >
                                {saving ? "Saving..." : initial ? "Update Asset" : "Add Asset"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                open={showConfirm}
                variant="save"
                title={initial ? "Update Asset?" : "Add Asset?"}
                message={`Please review the details below before ${initial ? "updating" : "adding"} this asset.`}
                confirmLabel={initial ? "Yes, Update" : "Yes, Add"}
                cancelLabel="Go Back"
                isLoading={saving}
                loadingLabel={initial ? "Updating..." : "Adding..."}
                onCancel={() => setShowConfirm(false)}
                onConfirm={handleConfirmSave}
            >
                <div className="divide-y divide-warm/60 text-sm">
                    <SummaryRow label="Item" value={values.itemDescription || "—"} />
                    <SummaryRow label="Type" value={values.type || "—"} />
                    <SummaryRow label="Serial #" value={values.serialNumber || "—"} />
                    <SummaryRow
                        label="Department"
                        value={effectiveDepartment || "—"}
                    />
                    <SummaryRow label="Space" value={values.space || "—"} />
                    <SummaryRow label="Vendor" value={values.vendor || "—"} />
                    <SummaryRow label="Purchase Price" value={`₱${Number(values.purchasePrice).toLocaleString()}`} />
                    <SummaryRow label="Asset Value" value={`₱${effectiveAssetValue.toLocaleString()}`} />
                    <SummaryRow label="Quantity" value={String(values.quantity)} />
                    <SummaryRow label="Total Value" value={`₱${computedTotalValue.toLocaleString()}`} />
                    <SummaryRow label="Date Purchased" value={values.datePurchase || "—"} />
                    <SummaryRow label="Warranty Date" value={values.warrantyDate || "—"} />
                    {values.remarks && (
                        <SummaryRow label="Remarks" value={values.remarks} />
                    )}
                </div>
            </ConfirmationModal>
        </>
    );
}

/* ---------------- sub-components ---------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted flex items-center gap-2">
                <span className="h-px flex-1 bg-warm/60" />
                {title}
                <span className="h-px flex-1 bg-warm/60" />
            </h4>
            {children}
        </div>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between px-3 py-2">
            <span className="text-ink-muted font-medium">{label}</span>
            <span className="text-ink text-right max-w-[55%] truncate font-medium">{value}</span>
        </div>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
                {required && <span className="ml-0.5 text-rose-500">*</span>}
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
            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal transition-all"
        />
    );
}