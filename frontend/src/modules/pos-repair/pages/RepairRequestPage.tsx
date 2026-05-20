import { useState } from "react";

const teal = "#92C7CF";

const statusTabs = [
    { id: "for-checking", label: "For Checking" },
    { id: "for-repair", label: "For Repair" },
    { id: "undergoing-repair", label: "Undergoing Repair" },
    { id: "for-release", label: "For Release" },
    { id: "released", label: "Released" },
];

export default function RepairRequestPage() {
    const [activeStatusTab, setActiveStatusTab] = useState("for-checking");

    return (
        <div>
            {/* Status tabs above the table */}
            <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
                {statusTabs.map((tab) => {
                    const isActive = activeStatusTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveStatusTab(tab.id)}
                            className="shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 sm:px-4 sm:text-sm"
                            style={{
                                background: isActive ? "rgba(146,199,207,0.15)" : "transparent",
                                border: isActive ? "1px solid rgba(146,199,207,0.25)" : "1px solid transparent",
                                color: isActive ? "#1F2937" : "#6B7280",
                                boxShadow: isActive ? "0 2px 8px rgba(146,199,207,0.10)" : "none",
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = "rgba(146,199,207,0.06)";
                                    e.currentTarget.style.color = teal;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = "transparent";
                                    e.currentTarget.style.color = "#6B7280";
                                }
                            }}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <h1 className="text-2xl font-bold">POS Repair Request</h1>
            <p>Submit a POS repair request.</p>
        </div>
    );
}
