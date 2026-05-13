import { ArrowRight, BarChart3, BellRing, FileCheck2 } from "lucide-react";
import { Link } from "react-router-dom";

import heroImage from "../assets/hero.png";

const highlights = [
    {
        title: "Live queue visibility",
        description: "Track requests, status changes, and response times from one calm workspace.",
        icon: BellRing,
    },
    {
        title: "Auditable records",
        description: "Keep every cancellation decision organized for fast review and reporting.",
        icon: FileCheck2,
    },
    {
        title: "Operational reporting",
        description: "Turn daily activity into clean summaries your team can act on immediately.",
        icon: BarChart3,
    },
];

export default function LandingPage() {
    return (
        <div
            className="min-h-screen overflow-hidden text-gray-800"
            style={{
                background: `
                    radial-gradient(circle at top left, rgba(146,199,207,0.38), transparent 34%),
                    radial-gradient(circle at 85% 18%, rgba(170,215,217,0.34), transparent 30%),
                    linear-gradient(135deg, #FBF9F1 0%, #E5E1DA 100%)
                `,
            }}
        >
            <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
                <Link
                    to="/"
                    className="inline-flex h-12 items-center rounded-2xl px-5 text-lg font-bold text-white shadow-lg"
                    style={{
                        background: "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                    }}
                >
                    Hexaprime Inc.
                </Link>

                <nav className="hidden items-center gap-7 text-sm font-medium text-gray-600 md:flex">
                    <Link to="/" className="transition-colors hover:text-gray-900">
                        Home
                    </Link>
                    <Link to="/" className="transition-colors hover:text-gray-900">
                        Social Responsibility
                    </Link>
                    <Link to="/" className="transition-colors hover:text-gray-900">
                        Results
                    </Link>
                    <Link to="/" className="transition-colors hover:text-gray-900">
                        About Us
                    </Link>
                </nav>

                <Link
                    to="/dashboard"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                    style={{
                        background: "rgba(255, 255, 255, 0.38)",
                        border: "1px solid rgba(255, 255, 255, 0.55)",
                        boxShadow:
                            "0 8px 28px rgba(31, 38, 135, 0.10), inset 0 1px 0 rgba(255,255,255,0.65)",
                    }}
                >
                    Open App
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
            </header>

            <main>
                <section className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl items-center gap-10 px-6 pb-14 pt-8 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pb-16">
                    <div className="max-w-3xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Small Town Lottery
                        </p>

                        <h1 className="mt-5 max-w-4xl text-5xl font-bold leading-[1.02] text-gray-800 sm:text-6xl lg:text-7xl">
                            Hexaprime Inc.
                        </h1>

                        <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
                            Sharing Care, Beyond the line with Hexaprime!
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link
                                to="/dashboard"
                                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                                style={{
                                    background:
                                        "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                                }}
                            >
                                View Dashboard
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                            <Link
                                to="/reports"
                                className="inline-flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold text-gray-700 transition-transform hover:-translate-y-0.5"
                                style={{
                                    background: "rgba(255, 255, 255, 0.34)",
                                    border: "1px solid rgba(255, 255, 255, 0.52)",
                                    boxShadow:
                                        "0 8px 28px rgba(31, 38, 135, 0.08), inset 0 1px 0 rgba(255,255,255,0.65)",
                                }}
                            >
                                Review Reports
                            </Link>
                        </div>

                        <div className="mt-11 grid gap-4 sm:grid-cols-3">
                            {highlights.map((item) => {
                                const Icon = item.icon;

                                return (
                                    <article
                                        key={item.title}
                                        className="rounded-3xl p-5 backdrop-blur-xl"
                                        style={{
                                            background: "rgba(255, 255, 255, 0.28)",
                                            border: "1px solid rgba(255, 255, 255, 0.45)",
                                            boxShadow:
                                                "0 8px 32px rgba(31, 38, 135, 0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
                                        }}
                                    >
                                        <span
                                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl"
                                            style={{
                                                background: "rgba(146, 199, 207, 0.22)",
                                                color: "#5f9da7",
                                            }}
                                        >
                                            <Icon className="h-5 w-5" aria-hidden="true" />
                                        </span>
                                        <h2 className="mt-4 text-base font-semibold text-gray-800">
                                            {item.title}
                                        </h2>
                                        <p className="mt-2 text-sm leading-6 text-gray-600">
                                            {item.description}
                                        </p>
                                    </article>
                                );
                            })}
                        </div>
                    </div>

                    <div
                        className="relative rounded-3xl p-3 shadow-2xl backdrop-blur-2xl"
                        style={{
                            background: "rgba(255, 255, 255, 0.28)",
                            border: "1px solid rgba(255, 255, 255, 0.48)",
                            boxShadow:
                                "0 20px 60px rgba(31, 38, 135, 0.14), inset 0 1px 0 rgba(255,255,255,0.65)",
                        }}
                    >

                        <img
                            src={heroImage}
                            alt="Cancellation monitoring dashboard preview"
                            className="h-full max-h-[620px] min-h-[360px] w-full rounded-[1.25rem] object-cover"
                        />
                    </div>
                </section>
            </main>
        </div>
    );
}
