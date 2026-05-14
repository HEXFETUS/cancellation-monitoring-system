import { useEffect, useState } from "react";
import {
    ArrowRight,
    BarChart3,
    BellRing,
    FileCheck2,
    ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import heroImage from "../assets/hero.png";
import { useAuth } from "../context/AuthContext";
import LoginModal from "../components/LoginModal";

const highlights = [
    {
        title: "Real-Time Monitoring",
        description:
            "Track cancellation requests, approvals, and operational activities in one unified dashboard.",
        icon: BellRing,
    },
    {
        title: "Secure Audit Trail",
        description:
            "Maintain complete and traceable records for every transaction and decision.",
        icon: FileCheck2,
    },
    {
        title: "Actionable Reports",
        description:
            "Generate insightful summaries that help management make faster and better decisions.",
        icon: BarChart3,
    },
];

export default function LandingPage() {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [loginOpen, setLoginOpen] = useState(false);
    const [pendingRoute, setPendingRoute] = useState<string | null>(null);

    const [isScrolled, setIsScrolled] = useState(false);
    const [isCompact, setIsCompact] = useState(false);
    const [activeSection, setActiveSection] = useState("home");

    const requireAuth = (path: string) => {
        if (isAuthenticated) {
            navigate(path);
        } else {
            setPendingRoute(path);
            setLoginOpen(true);
        }
    };

    const handleLoginSuccess = () => {
        setLoginOpen(false);
        navigate(pendingRoute || "/dashboard");
        setPendingRoute(null);
    };

    const handleClose = () => {
        setLoginOpen(false);
        setPendingRoute(null);
    };

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    // 🔥 Apple-style scroll + intersection observer
    useEffect(() => {
        const sectionIds = [
            "home",
            "social-responsibility",
            "results",
            "about-us",
        ];

        const onScroll = () => {
            const scrolled = window.scrollY > 40;
            setIsScrolled(scrolled);
            setIsCompact(window.scrollY > 80);
        };

        window.addEventListener("scroll", onScroll);
        onScroll();

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort(
                        (a, b) =>
                            b.intersectionRatio - a.intersectionRatio
                    );

                if (visible.length > 0) {
                    setActiveSection(visible[0].target.id);
                }
            },
            {
                threshold: [0.25, 0.5, 0.75],
                rootMargin: "-20% 0px -55% 0px",
            }
        );

        sectionIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => {
            window.removeEventListener("scroll", onScroll);
            observer.disconnect();
        };
    }, []);

    const navItemClass = (id: string) =>
        `transition-colors ${
            activeSection === id
                ? "text-gray-900 font-semibold"
                : "text-gray-600 hover:text-gray-900"
        }`;

    return (
        <div
            className="min-h-screen overflow-x-hidden text-gray-800"
            style={{
                background: `
                    radial-gradient(circle at top left, rgba(146,199,207,0.38), transparent 34%),
                    radial-gradient(circle at 85% 18%, rgba(170,215,217,0.34), transparent 30%),
                    linear-gradient(135deg, #FBF9F1 0%, #E5E1DA 100%)
                `,
            }}
        >
            <LoginModal
                open={loginOpen}
                onClose={handleClose}
                onSuccess={handleLoginSuccess}
            />

            {/* HEADER (Apple-style morphing) */}
            <header
                className={`fixed top-0 left-0 z-50 w-full border-b backdrop-blur-xl transition-all duration-500 ease-in-out ${
                    isScrolled
                        ? "bg-white/70 shadow-md border-white/50"
                        : "bg-white/40 border-white/30"
                }`}
            >
                <div
                    className={`mx-auto flex w-full max-w-7xl items-center justify-between px-6 lg:px-8 transition-all duration-500 ease-in-out ${
                        isCompact ? "py-2" : "py-5"
                    }`}
                >
                    {/* LOGO */}
                    <span
                        className={`inline-flex items-center rounded-2xl font-semibold text-white shadow-lg transition-all duration-500 ease-in-out ${
                            isCompact
                                ? "h-9 px-4 text-sm scale-95"
                                : "h-12 px-5 text-lg scale-100"
                        }`}
                        style={{
                            background:
                                "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                        }}
                    >
                        Hexaprime Inc.
                    </span>

                    {/* NAV */}
                    <nav
                        className={`hidden md:flex items-center font-semibold transition-all duration-500 ease-in-out ${
                            isCompact ? "gap-4 text-xs" : "gap-7 text-sm"
                        }`}
                    >
                        <button
                            onClick={() => scrollToSection("home")}
                            className={navItemClass("home")}
                        >
                            Home
                        </button>

                        <button
                            onClick={() =>
                                scrollToSection("social-responsibility")
                            }
                            className={navItemClass("social-responsibility")}
                        >
                            Social Responsibility
                        </button>

                        <button
                            onClick={() => scrollToSection("results")}
                            className={navItemClass("results")}
                        >
                            Results
                        </button>

                        <button
                            onClick={() => scrollToSection("about-us")}
                            className={navItemClass("about-us")}
                        >
                            About Us
                        </button>
                    </nav>

                    {/* BUTTON */}
                    <button
                        onClick={() => requireAuth("/dashboard")}
                        className={`inline-flex items-center gap-2 rounded-2xl font-semibold text-gray-800 transition-all duration-500 ease-in-out ${
                            isCompact
                                ? "h-9 px-4 text-xs"
                                : "h-10 px-5 text-sm"
                        }`}
                        style={{
                            background: "rgba(255, 255, 255, 0.38)",
                            border: "1px solid rgba(255, 255, 255, 0.55)",
                        }}
                    >
                        Log In
                        <ArrowRight
                            className={`transition-all duration-500 ${
                                isCompact ? "h-3 w-3" : "h-4 w-4"
                            }`}
                        />
                    </button>
                </div>
            </header>

            {/* MAIN (IMPORTANT FIX: prevents header overlap) */}
            <main className="pt-[88px]">
                {/* HERO */}
                <section
                    id="home"
                    className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl items-center gap-14 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8"
                >
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 backdrop-blur-md">
                            <ShieldCheck className="h-4 w-4 text-[#5f9da7]" />
                            Small Town Lottery
                        </div>

                        <h1 className="mt-6 text-5xl font-bold leading-tight text-gray-800 sm:text-6xl lg:text-7xl">
                            Sharing Care Beyond the Line
                            <span
                                className="block bg-gradient-to-r bg-clip-text text-transparent"
                                style={{
                                    backgroundImage:
                                        "linear-gradient(135deg, #5f9da7 0%, #92C7CF 45%, #AAD7D9 100%)",
                                }}
                            >
                                with Hexaprime
                            </span>
                        </h1>
                    </div>

                    <div className="relative">
                        <img
                            src={heroImage}
                            className="rounded-[2rem] object-cover"
                        />
                    </div>
                </section>

                {/* SECTIONS */}
                <section
                    id="social-responsibility"
                    className="mx-auto max-w-7xl px-6 py-4 lg:px-8"
                >
                    <div className="rounded-[2.5rem] border border-white/40 bg-white/35 p-12 backdrop-blur-xl">
                        <h2 className="text-4xl font-bold">
                            Social Responsibility
                        </h2>
                    </div>
                </section>

                <section
                    id="results"
                    className="mx-auto max-w-7xl px-6 py-4 lg:px-8"
                >
                    <div className="rounded-[2.5rem] border border-white/40 bg-white/35 p-12 backdrop-blur-xl">
                        <h2 className="text-4xl font-bold">Results</h2>
                    </div>
                </section>

                <section
                    id="about-us"
                    className="mx-auto max-w-7xl px-6 py-4 lg:px-8"
                >
                    <div className="rounded-[2.5rem] border border-white/40 bg-white/35 p-12 backdrop-blur-xl">
                        <h2 className="text-4xl font-bold">About Us</h2>
                    </div>
                </section>
            </main>
        </div>
    );
}