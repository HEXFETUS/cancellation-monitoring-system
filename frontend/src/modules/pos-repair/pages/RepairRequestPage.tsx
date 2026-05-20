import { useState } from "react";

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
                            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 sm:px-4 sm:text-sm ${
                                isActive
                                    ? "bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200"
                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            }`}
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