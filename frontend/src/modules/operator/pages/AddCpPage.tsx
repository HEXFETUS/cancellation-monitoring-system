import { useEffect, useState } from "react";
import { Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
}

export default function AddCpPage() {
    const { user } = useAuth();
    const [me, setMe] = useState<Me | null>(null);

    // Form state
    const [brand, setBrand] = useState("");
    const [model, setModel] = useState("");
    const [specs, setSpecs] = useState("");
    const [sn, setSn] = useState("");
    const [imei1, setImei1] = useState("");
    const [imei2, setImei2] = useState("");
    const [controlNo, setControlNo] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Feedback state
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    // Auto-detect operator from logged-in user
    useEffect(() => {
        const init = async () => {
            if (!user?.id) return;
            try {
                const meRes = await fetch(`${API_BASE_URL}/api/users/me?id=${user.id}`);
                const meData = meRes.ok ? await meRes.json() : null;
                if (meData) {
                    setMe({
                        id: meData.id,
                        operator_id: meData.operator_id ?? null,
                        parent_operator_id: meData.parent_operator_id ?? null,
                    });
                }
            } catch {
                // silently fail
            }
        };
        init();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

    // Validation — all fields required
        if (!brand.trim()) {
            setErrorMessage("Brand is required");
            return;
        }
        if (!model.trim()) {
            setErrorMessage("Model is required");
            return;
        }
        if (!specs.trim()) {
            setErrorMessage("Specs is required");
            return;
        }
        if (!sn.trim()) {
            setErrorMessage("Serial number is required");
            return;
        }
        if (!imei1.trim() && !imei2.trim()) {
            setErrorMessage("At least one IMEI (IMEI1 or IMEI2) is required");
            return;
        }
        if (!controlNo.trim()) {
            setErrorMessage("Control number is required");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/cellphones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    brand: brand.trim(),
                    model: model.trim(),
                    specs: specs.trim(),
                    serialNumber: sn.trim(),
                    imei1: imei1.trim() || null,
                    imei2: imei2.trim() || null,
                    controlNo: controlNo.trim(),
                    operatorId: me?.operator_id,
                    addedByUserId: user?.id,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to add cellphone");
            }

            setSuccessMessage("Cellphone added successfully under your operator account.");
            setBrand("");
            setModel("");
            setSpecs("");
            setSn("");
            setImei1("");
            setImei2("");
            setControlNo("");
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to add cellphone");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto">
            <div className="rounded-xl border border-warm bg-card shadow-sm overflow-hidden">
                {/* Header */}
                <div className="border-b border-warm bg-cream px-6 py-4">
                    <h2 className="text-lg font-bold text-ink">Add New Cellphone</h2>
                    <p className="mt-1 text-sm text-ink-muted">
                        Register a new cellphone device under your operator account.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Feedback messages */}
                    {successMessage && (
                        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                            <CheckCircle2 size={16} className="shrink-0" />
                            {successMessage}
                        </div>
                    )}
                    {errorMessage && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                            <AlertCircle size={16} className="shrink-0" />
                            {errorMessage}
                        </div>
                    )}

                    {/* Brand */}
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Brand <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            placeholder="e.g. Samsung"
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            disabled={submitting}
                        />
                    </div>

                    {/* Model */}
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Model <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="e.g. Galaxy S24 Ultra"
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            disabled={submitting}
                        />
                    </div>

                    {/* Specs */}
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Specs <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={specs}
                            onChange={(e) => setSpecs(e.target.value)}
                            placeholder="e.g. 12GB RAM, 256GB Storage"
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            disabled={submitting}
                        />
                    </div>

                    {/* SN */}
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            SN <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={sn}
                            onChange={(e) => setSn(e.target.value)}
                            placeholder="e.g. SN-123456"
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            disabled={submitting}
                        />
                    </div>

                    {/* IMEI1 */}
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            IMEI1 <span className="text-xs font-normal normal-case text-ink-subtle">(at least one required)</span>
                        </label>
                        <input
                            type="text"
                            value={imei1}
                            onChange={(e) => setImei1(e.target.value)}
                            placeholder="e.g. 123456789012345"
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            disabled={submitting}
                        />
                    </div>

                    {/* IMEI2 */}
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            IMEI2 <span className="text-xs font-normal normal-case text-ink-subtle">(at least one required)</span>
                        </label>
                        <input
                            type="text"
                            value={imei2}
                            onChange={(e) => setImei2(e.target.value)}
                            placeholder="e.g. 123456789012346"
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            disabled={submitting}
                        />
                    </div>

                    {/* Control No. */}
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Control No. <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={controlNo}
                            onChange={(e) => setControlNo(e.target.value)}
                            placeholder="e.g. BMC-001"
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            disabled={submitting}
                        />
                    </div>

                    {/* Submit button */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                            background: "linear-gradient(135deg, #92C7CF, #AAD7D9)",
                            boxShadow: "0 2px 8px rgba(146,199,207,0.25)",
                        }}
                    >
                        <Plus size={16} />
                        {submitting ? "Adding..." : "Add Cellphone"}
                    </button>
                </form>
            </div>
        </div>
    );
}