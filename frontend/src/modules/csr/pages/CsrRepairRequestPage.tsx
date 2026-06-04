import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardList, Save, RotateCcw } from "lucide-react";
import { listDiagnoses, type DiagnosisItem } from "../services/diagnosisList";
import { searchPosRecords, type PosRecord } from "../services/posRecords";
import { checkRepairRequestEligibility, createRepairRecord } from "../services/repairRecords";
import { ConfirmationModal, Toast } from "../../../shared/components";

const teal = "#92C7CF";
const tealLight = "#AAD7D9";

export default function CsrRepairRequestPage() {
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem("theme") === "dark";
    });

    const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([]);
    const [diagnosesLoading, setDiagnosesLoading] = useState(true);

    const [posRecordId, setPosRecordId] = useState<number | null>(null);
    const [selectedPosStatus, setSelectedPosStatus] = useState("");
    const [posEligibilityError, setPosEligibilityError] = useState("");
    const [checkingPosEligibility, setCheckingPosEligibility] = useState(false);
    const [diagnosisId, setDiagnosisId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        serialNumber: "",
        posNumber: "",
        area: "",
        operator: "",
        diagnosis: "",
        accessories: { ntc: false, withCharger: false, withBox: false },
        deliveredBy: "",
    });

    // Toast state
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<"error" | "success">("error");

    const showToast = (message: string, type: "error" | "success" = "error") => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    const hideToast = () => {
        setToastOpen(false);
    };

    // Validation: check if required fields are filled
    const isFormValid =
        posRecordId !== null &&
        formData.operator.trim() !== "" &&
        formData.diagnosis.trim() !== "" &&
        formData.deliveredBy.trim() !== "" &&
        !posEligibilityError &&
        !checkingPosEligibility;

    // Autocomplete state
    const [searchResults, setSearchResults] = useState<PosRecord[]>([]);
    const [searching, setSearching] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<"serialNumber" | "posNumber" | null>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleCheckbox = (field: "ntc" | "withCharger" | "withBox") => {
        setFormData((prev) => ({
            ...prev,
            accessories: { ...prev.accessories, [field]: !prev.accessories[field] },
        }));
    };

    const handleSearch = useCallback((query: string, source: "serialNumber" | "posNumber") => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        if (!query.trim()) {
            setSearchResults([]);
            setActiveDropdown(null);
            return;
        }

        setActiveDropdown(source);
        setSearching(true);

        debounceTimer.current = setTimeout(async () => {
            try {
                const results = await searchPosRecords(query);
                setSearchResults(results);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
    }, []);

    const handleFieldChange = (field: "serialNumber" | "posNumber", value: string) => {
        handleChange(field, value);
        setPosRecordId(null);
        setSelectedPosStatus("");
        setPosEligibilityError("");
        setCheckingPosEligibility(false);
        handleSearch(value, field);
    };

    const handleSelectRecord = async (record: PosRecord) => {
        setFormData((prev) => ({
            ...prev,
            serialNumber: record.serial_number || "",
            posNumber: record.device_no || "",
            area: record.area || "",
            operator: record.operator || "",
        }));
        setPosRecordId(record.id);
        setSelectedPosStatus(record.status || "");
        setPosEligibilityError("");
        setSearchResults([]);
        setActiveDropdown(null);

        if (record.status?.trim().toLowerCase() === "not released") {
            const message = "The POS is already being repaired";
            setPosEligibilityError(message);
            showToast(message);
            return;
        }

        setCheckingPosEligibility(true);
        try {
            const result = await checkRepairRequestEligibility(record.id);
            if (!result.eligible) {
                const message = result.error || "The POS is already being repaired";
                setPosEligibilityError(message);
                showToast(message);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to check POS repair eligibility";
            setPosEligibilityError(message);
            showToast(message);
        } finally {
            setCheckingPosEligibility(false);
        }
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setSearchResults([]);
                setActiveDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Cleanup debounce timer
    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, []);

    // Listen for dark mode changes
    useEffect(() => {
        const handleThemeChange = () => {
            setDarkMode(localStorage.getItem("theme") === "dark");
        };

        const observer = new MutationObserver(() => {
            setDarkMode(document.documentElement.classList.contains("dark"));
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("storage", handleThemeChange);
        return () => {
            observer.disconnect();
            window.removeEventListener("storage", handleThemeChange);
        };
    }, []);

    const validateForm = () => {
        if (!posRecordId) {
            showToast("Please select a POS record by searching in Serial Number or POS Number.");
            return false;
        }

        if (selectedPosStatus.trim().toLowerCase() === "not released") {
            showToast("The POS is already being repaired");
            return false;
        }

        if (posEligibilityError) {
            showToast(posEligibilityError);
            return false;
        }

        if (checkingPosEligibility) {
            showToast("Please wait while checking POS repair eligibility.");
            return false;
        }

        if (!isFormValid) {
            const missingFields = [];
            if (!formData.operator.trim()) missingFields.push("Operator");
            if (!formData.diagnosis.trim()) missingFields.push("Diagnosis");
            if (!formData.deliveredBy.trim()) missingFields.push("Delivered By");
            showToast(`Please fill in the following fields: ${missingFields.join(", ")}`);
            return false;
        }

        return true;
    };

    const handleSubmit = () => {
        if (!validateForm()) return;
        setShowSaveConfirm(true);
    };

    const handleConfirmSave = async () => {
        if (!posRecordId) {
            setShowSaveConfirm(false);
            showToast("Please select a POS record by searching in Serial Number or POS Number.");
            return;
        }

        setSaving(true);
        try {
            const response = await createRepairRecord({
                date: formData.date,
                pos_record_id: posRecordId,
                ntc: formData.accessories.ntc,
                operator_name: formData.operator,
                diagnosis_id: diagnosisId,
                delivered_by: formData.deliveredBy,
                with_charger: formData.accessories.withCharger,
                with_box: formData.accessories.withBox,
                status: "For Request",
            });
            const message = response.isUpdate
                ? "Repair record updated successfully!"
                : "Repair record saved successfully!";
            showToast(message, "success");
            setShowSaveConfirm(false);
            setFormData({
                date: new Date().toISOString().split("T")[0],
                serialNumber: "",
                posNumber: "",
                area: "",
                operator: "",
                diagnosis: "",
                accessories: { ntc: false, withCharger: false, withBox: false },
                deliveredBy: "",
            });
            setPosRecordId(null);
            setSelectedPosStatus("");
            setPosEligibilityError("");
            setDiagnosisId(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save repair record";
            showToast(message);
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        listDiagnoses()
            .then(setDiagnoses)
            .catch((err) => {
                console.error("Failed to load diagnoses:", err);
            })
            .finally(() => setDiagnosesLoading(false));
    }, []);

    const handleCancel = () => {
        setFormData({
            date: new Date().toISOString().split("T")[0],
            serialNumber: "",
            posNumber: "",
            area: "",
            operator: "",
            diagnosis: "",
            accessories: { ntc: false, withCharger: false, withBox: false },
            deliveredBy: "",
        });
        setPosRecordId(null);
        setSelectedPosStatus("");
        setPosEligibilityError("");
        setCheckingPosEligibility(false);
        setDiagnosisId(null);
        setSearchResults([]);
        setActiveDropdown(null);
    };

    const inputStyle = darkMode ? {
        background: "rgba(31,41,55,0.70)",
        border: "1px solid rgba(75,85,99,0.50)",
        boxShadow: "inset 0 1px 0 rgba(0,0,0,0.20)",
        backdropFilter: "blur(8px)",
        color: "#E5E7EB",
    } : {
        background: "rgba(255,255,255,0.58)",
        border: "1px solid rgba(146,199,207,0.28)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
        backdropFilter: "blur(8px)",
    };

    const readOnlyInputStyle = darkMode ? {
        ...inputStyle,
        background: "rgba(55,65,81,0.60)",
        color: "#D1D5DB",
        cursor: "default" as const,
    } : {
        ...inputStyle,
        background: "rgba(243,244,246,0.62)",
        color: "#4B5563",
        cursor: "default" as const,
    };

    const labelClass = darkMode
        ? "block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5"
        : "block text-[11px] font-semibold uppercase tracking-wider text-gray-600 mb-1.5";
    const inputClass = darkMode
        ? "h-10 w-full rounded-xl px-3.5 text-sm text-gray-100 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#92C7CF]/50 focus:border-[#92C7CF]/60 placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-70 hover:border-[#92C7CF]/45 hover:shadow-md dark:placeholder:text-gray-500"
        : "h-10 w-full rounded-xl px-3.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#92C7CF]/35 focus:border-[#92C7CF]/60 placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-70 hover:border-[#92C7CF]/45 hover:shadow-md";

    const dropdownItemClass = darkMode
        ? "px-4 py-3 text-sm text-gray-100 hover:bg-[#92C7CF]/25 cursor-pointer transition-colors duration-100 flex justify-between items-center gap-4"
        : "px-4 py-3 text-sm text-gray-800 hover:bg-[#92C7CF]/15 cursor-pointer transition-colors duration-100 flex justify-between items-center gap-4";

    const renderDropdown = () => {
        if (!activeDropdown) return null;
        if (searchResults.length === 0 && !searching) return null;

        return (
            <div
                ref={dropdownRef}
                className={darkMode
                    ? "absolute z-50 mt-2 w-full rounded-xl border border-gray-700 bg-gray-800/95 backdrop-blur-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
                    : "absolute z-50 mt-2 w-full rounded-xl border border-white/60 bg-white/95 backdrop-blur-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
                }
            >
                {searching ? (
                    <div className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-center`}>Searching…</div>
                ) : searchResults.length === 0 ? (
                    <div className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-center`}>
                        No available POS records found. All records may already have active repair requests.
                    </div>
                ) : (
                    <>
                        <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500 bg-gray-700/50' : 'text-gray-400 bg-[#F8FAFA]'}`}>
                            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                        </div>
                        {searchResults.map((record) => (
                            <div
                                key={record.id}
                                className={`${dropdownItemClass} ${darkMode ? 'border-gray-700/50' : 'border-gray-100/50'} last:border-b-0`}
                                onClick={() => handleSelectRecord(record)}
                            >
                                <div className="flex flex-col">
                                    <span className="font-medium">
                                        {activeDropdown === "serialNumber"
                                            ? record.serial_number
                                            : record.device_no}
                                    </span>
                                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                                        {activeDropdown === "serialNumber"
                                            ? `POS: ${record.device_no || "—"}`
                                            : `SN: ${record.serial_number || "—"}`}
                                        {record.area ? ` · Area: ${record.area}` : ""}
                                        {record.operator ? ` · ${record.operator}` : ""}
                                    </span>
                                </div>
                                <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${record.status === "Active"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-gray-100 text-gray-600"
                                        }`}
                                >
                                    {record.status}
                                </span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="w-full max-w-5xl space-y-5">
            {/* Header */}
            <div className="relative rounded-2xl p-5 border border-white/50 backdrop-blur-xl bg-white/30 shadow-lg overflow-hidden">
                <div
                    className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15 blur-3xl pointer-events-none"
                    style={{ background: teal }}
                />
                <div className="relative flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-11 w-11 items-center justify-center rounded-xl shadow-md transition-transform duration-300 hover:scale-110"
                            style={{
                                background: `linear-gradient(135deg, ${teal}20, ${tealLight}20)`,
                                color: teal,
                            }}
                        >
                            <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-800">New Repair Record</h1>
                            <p className="text-sm text-gray-600">Create a CSR repair intake record</p>
                        </div>
                    </div>
                    <span
                        className="hidden rounded-full px-3 py-1 text-xs font-semibold text-gray-600 sm:inline-flex"
                        style={{
                            background: posRecordId ? "rgba(107,191,107,0.14)" : "rgba(255,255,255,0.45)",
                            border: posRecordId
                                ? "1px solid rgba(107,191,107,0.22)"
                                : "1px solid rgba(146,199,207,0.18)",
                        }}
                    >
                        {posRecordId ? "POS selected" : "Search POS first"}
                    </span>
                </div>
            </div>

            <Toast open={toastOpen} message={toastMessage} type={toastType} onClose={hideToast} />

            {/* Form Card */}
            <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                <div className="border-b border-white/40 px-5 py-3">
                    <h2 className="text-sm font-semibold text-gray-800">Request Details</h2>
                    <p className="text-xs text-gray-500">Required intake information for the repair log</p>
                </div>
                <div className="relative space-y-4 p-4 sm:p-5">
                    {/* Row 1: Date + Serial Number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Date</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => handleChange("date", e.target.value)}
                                className={inputClass}
                                style={inputStyle}
                            />
                        </div>
                        <div className="relative">
                            <label className={labelClass}>
                                Serial Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.serialNumber}
                                onChange={(e) => handleFieldChange("serialNumber", e.target.value)}
                                onFocus={() => {
                                    if (formData.serialNumber.trim() && searchResults.length > 0) {
                                        setActiveDropdown("serialNumber");
                                    }
                                }}
                                className={inputClass}
                                style={inputStyle}
                                placeholder="Search serial number"
                            />
                            {activeDropdown === "serialNumber" && renderDropdown()}
                        </div>
                    </div>

                    {/* Row 2: POS Number + Area */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="relative">
                            <label className={labelClass}>
                                POS Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.posNumber}
                                onChange={(e) => handleFieldChange("posNumber", e.target.value)}
                                onFocus={() => {
                                    if (formData.posNumber.trim() && searchResults.length > 0) {
                                        setActiveDropdown("posNumber");
                                    }
                                }}
                                className={inputClass}
                                style={inputStyle}
                                placeholder="Search POS number"
                            />
                            {activeDropdown === "posNumber" && renderDropdown()}
                        </div>
                        <div>
                            <label className={labelClass}>
                                Area <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.area}
                                readOnly
                                className={inputClass}
                                style={readOnlyInputStyle}
                                placeholder="Auto-filled from POS record"
                            />
                        </div>
                    </div>

                    {/* Row 3: Operator + Diagnosis */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>
                                Operator <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.operator}
                                onChange={(e) => handleChange("operator", e.target.value)}
                                className={inputClass}
                                style={inputStyle}
                                placeholder="Operator name"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>
                                Diagnosis <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.diagnosis}
                                onChange={(e) => {
                                    const selectedName = e.target.value;
                                    handleChange("diagnosis", selectedName);
                                    const match = diagnoses.find((d) => d.name === selectedName);
                                    setDiagnosisId(match ? match.id : null);
                                }}
                                className={inputClass}
                                style={inputStyle}
                                disabled={diagnosesLoading}
                            >
                                <option value="">
                                    {diagnosesLoading ? "Loading…" : "-- Select --"}
                                </option>
                                {diagnoses.map((d) => (
                                    <option key={d.id} value={d.name} style={{ textTransform: "uppercase" }}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 4: Accessories (checkboxes) */}
                    <div className="rounded-xl border border-[#92C7CF]/18 bg-white/30 p-3">
                        <label className={labelClass}>Accessories</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {[
                                { key: "ntc" as const, label: "NTC" },
                                { key: "withCharger" as const, label: "With Charger" },
                                { key: "withBox" as const, label: "With Box" },
                            ].map((item) => (
                                <label
                                    key={item.key}
                                    className="flex h-10 items-center gap-2 rounded-xl px-3.5 cursor-pointer transition-all duration-200 hover:scale-[1.03] hover:shadow-md"
                                    style={{
                                        background: formData.accessories[item.key]
                                            ? "rgba(146,199,207,0.15)"
                                            : "rgba(255,255,255,0.35)",
                                        border: formData.accessories[item.key]
                                            ? "1px solid rgba(146,199,207,0.35)"
                                            : "1px solid rgba(146,199,207,0.15)",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.accessories[item.key]}
                                        onChange={() => handleCheckbox(item.key)}
                                        className="w-4 h-4 rounded accent-[#92C7CF]"
                                    />
                                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Row 5: Delivered By */}
                    <div>
                        <label className={labelClass}>
                            Delivered By <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.deliveredBy}
                            onChange={(e) => handleChange("deliveredBy", e.target.value)}
                            className={inputClass}
                            style={inputStyle}
                            placeholder="Delivered by"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col-reverse gap-2 border-t border-white/40 pt-4 sm:flex-row sm:items-center sm:justify-end">
                        <button
                            onClick={handleCancel}
                            className="group inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-white/50 hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                                border: "1px solid rgba(146,199,207,0.20)",
                                background: "rgba(255,255,255,0.25)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                            }}
                        >
                            <RotateCcw className="h-4 w-4 transition-transform duration-200 group-hover:-rotate-12" />
                            Clear
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving || !isFormValid}
                            className="group inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-xl hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg"
                            style={{
                                background: `linear-gradient(135deg, ${teal}, ${tealLight})`,
                                boxShadow: `0 4px 16px rgba(146,199,207,0.30)`,
                                opacity: saving || !isFormValid ? 0.72 : 1,
                            }}
                        >
                            <Save className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                            {saving ? "Saving..." : "Save Record"}
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                open={showSaveConfirm}
                title="Save repair record?"
                message={`This will create a repair record for POS ${formData.posNumber || "selected POS"}.`}
                confirmLabel="Save Record"
                isLoading={saving}
                onCancel={() => setShowSaveConfirm(false)}
                onConfirm={handleConfirmSave}
            />
        </div>
    );
}
