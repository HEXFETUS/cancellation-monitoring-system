import { useState } from "react";
import { Search } from "lucide-react";

interface AssetCode {
    id: number;
    itemCode: string;
    description: string;
    type: string;
    department: string;
    careOf: string;
    space: string;
}

// TODO: replace with API data once /api/asset-codes endpoint exists
const MOCK_ASSET_CODES: AssetCode[] = [
    {
        id: 1,
        itemCode: "OFC-001",
        description: "Executive Office Desk",
        type: "Furniture",
        department: "Office",
        careOf: "Admin Officer",
        space: "Main Office",
    },
    {
        id: 2,
        itemCode: "PYO-014",
        description: "Cash Counting Machine",
        type: "Equipment",
        department: "Payout",
        careOf: "Payout Supervisor",
        space: "Payout Counter",
    },
    {
        id: 3,
        itemCode: "DRW-003",
        description: "Draw Console Monitor",
        type: "Electronics",
        department: "Drawcourt",
        careOf: "Draw Master",
        space: "Drawcourt Hall",
    },
    {
        id: 4,
        itemCode: "OBS-009",
        description: "Surveillance Camera",
        type: "Electronics",
        department: "OBS",
        careOf: "Security Officer",
        space: "Lobby",
    },
];

export default function AssetCodingPage() {
    const [search, setSearch] = useState("");
    const [items] = useState<AssetCode[]>(MOCK_ASSET_CODES);

    const filtered = items.filter((item) => {
        const q = search.toLowerCase();
        return (
            item.itemCode.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.type.toLowerCase().includes(q) ||
            item.department.toLowerCase().includes(q) ||
            item.careOf.toLowerCase().includes(q) ||
            item.space.toLowerCase().includes(q)
        );
    });

    return (
        <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-ink">Asset Coding</h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Master list of all asset codes used across departments.
                    </p>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-72">
                    <Search
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
                        size={16}
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search assets..."
                        className="w-full rounded-lg border border-warm bg-card pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-cream border-b border-warm">
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Item Code
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Description
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Type
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Department
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Care Of
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Space
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((item) => (
                            <tr
                                key={item.id}
                                className="border-b border-warm/60 transition hover:bg-cream"
                            >
                                <td className="px-4 py-3 text-sm font-medium text-ink">
                                    {item.itemCode}
                                </td>
                                <td className="px-4 py-3 text-sm text-ink">
                                    {item.description}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    <span className="inline-block rounded-full border border-teal/30 bg-teal-light/40 px-2.5 py-0.5 text-xs font-medium text-ink">
                                        {item.type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-ink-muted">
                                    {item.department}
                                </td>
                                <td className="px-4 py-3 text-sm text-ink-muted">
                                    {item.careOf}
                                </td>
                                <td className="px-4 py-3 text-sm text-ink-muted">
                                    {item.space}
                                </td>
                            </tr>
                        ))}

                        {filtered.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-8 text-center text-sm text-ink-subtle"
                                >
                                    No asset codes match your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <p className="mt-3 text-xs text-ink-subtle">
                Showing {filtered.length} of {items.length} asset codes
            </p>
        </div>
    );
}
