export default function DashboardPage() {
    const cards = [
        {
            title: "Total Records",
            value: "128",
            description: "All cancellation requests",
            accent: "#92C7CF",
        },
        {
            title: "Pending",
            value: "32",
            description: "Awaiting review and approval",
            accent: "#AAD7D9",
        },
        {
            title: "Resolved",
            value: "96",
            description: "Successfully completed requests",
            accent: "#92C7CF",
        },
        {
            title: "Automation Status",
            value: "Running",
            description: "Cartracker",
            accent: "#92C7CF",
        },
        {
            title: "Active Booths",
            value: "1324",
            description: "Running POS terminals",
            accent: "#AAD7D9",
        },
        {
            title: "Under Repair",
            value: "30",
            description: "POS terminals requiring maintenance",
            accent: "#92C7CF",
        },
    ];

    return (
        <div className="space-y-8">
            {/* User Header */}
            <div
                className="rounded-3xl p-6 border shadow-2xl backdrop-blur-xl"
                style={{
                    background: "rgba(255, 255, 255, 0.30)",
                    border: "1px solid rgba(255, 255, 255, 0.45)",
                    boxShadow:
                        "0 8px 32px rgba(31, 38, 135, 0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                }}
            >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    {/* Left Section */}
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                            style={{
                                background:
                                    "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                            }}
                        >
                            KB
                        </div>

                        {/* User Info */}
                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Welcome back,
                            </p>
                            <h1 className="text-3xl font-bold tracking-tight text-gray-800">
                                Kedev Boo
                            </h1>
                            <p className="mt-1 text-sm text-gray-600">
                                IT Manager • Hexaprime Inc.
                            </p>
                        </div>
                    </div>

                    {/* Right Section */}
                    <div className="grid grid-cols-2 gap-4 min-w-[280px]">
                        <div
                            className="rounded-2xl px-4 py-3 border"
                            style={{
                                background: "rgba(255,255,255,0.25)",
                                border: "1px solid rgba(255,255,255,0.35)",
                            }}
                        >
                            <p className="text-xs uppercase tracking-wider text-gray-500">
                                Role
                            </p>
                            <p className="mt-1 font-semibold text-gray-800">
                                Administrator
                            </p>
                        </div>

                        <div
                            className="rounded-2xl px-4 py-3 border"
                            style={{
                                background: "rgba(255,255,255,0.25)",
                                border: "1px solid rgba(255,255,255,0.35)",
                            }}
                        >
                            <p className="text-xs uppercase tracking-wider text-gray-500">
                                Status
                            </p>
                            <p className="mt-1 font-semibold text-emerald-600">
                                ● Online
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cards.map((card) => (
                    <div
                        key={card.title}
                        className="relative overflow-hidden rounded-3xl p-6 border shadow-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1"
                        style={{
                            background: "rgba(255, 255, 255, 0.35)",
                            border: "1px solid rgba(255, 255, 255, 0.45)",
                            boxShadow:
                                "0 8px 32px rgba(31, 38, 135, 0.12), inset 0 1px 0 rgba(255,255,255,0.6)",
                            backdropFilter: "blur(18px)",
                            WebkitBackdropFilter: "blur(18px)",
                        }}
                    >
                        {/* Accent Glow */}
                        <div
                            className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-40"
                            style={{ backgroundColor: card.accent }}
                        />

                        {/* Top Accent Bar */}
                        <div
                            className="absolute top-0 left-0 w-full h-1"
                            style={{
                                background: `linear-gradient(90deg, ${card.accent}, transparent)`,
                            }}
                        />

                        <div className="relative z-10">
                            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                                {card.title}
                            </p>

                            <h2
                                className="mt-4 text-5xl font-bold"
                                style={{ color: card.accent }}
                            >
                                {card.value}
                            </h2>

                            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                                {card.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Overview Panel */}
            <div
                className="rounded-3xl p-6 border shadow-2xl backdrop-blur-xl"
                style={{
                    background: "rgba(255, 255, 255, 0.30)",
                    border: "1px solid rgba(255, 255, 255, 0.45)",
                    boxShadow:
                        "0 8px 32px rgba(31, 38, 135, 0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                }}
            >
                <h3 className="text-xl font-semibold text-gray-800">
                    System Overview
                </h3>
                <p className="mt-3 text-gray-600 leading-relaxed">
                    Real-time monitoring of cancellation requests, automation
                    services, and POS terminal health across all active booths.
                </p>
            </div>
        </div>
    );
}