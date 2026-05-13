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
        <div
            className="min-h-screen p-8"
            style={{
                background: `
                    radial-gradient(circle at top left, rgba(146,199,207,0.35), transparent 40%),
                    radial-gradient(circle at top right, rgba(170,215,217,0.30), transparent 35%),
                    linear-gradient(135deg, #FBF9F1 0%, #E5E1DA 100%)
                `,
            }}
        >
            {/* Header */}
            <div className="mb-10">
                <h1 className="text-4xl font-bold tracking-tight text-gray-800">
                    Dashboard
                </h1>
                <p className="mt-2 text-gray-600">
                    Cancellation Monitoring System
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cards.map((card) => (
                    <div
                        key={card.title}
                        className="relative overflow-hidden rounded-3xl p-6 border shadow-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-3xl"
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
                className="mt-8 rounded-3xl p-6 border shadow-2xl backdrop-blur-xl"
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
            </div>
        </div>
    );
}