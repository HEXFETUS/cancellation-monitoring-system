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

/* ---------------- DATA ---------------- */
const socialImpact = [
    {
        title: "Typhoon Relief Operations",
        description:
            "Distributed food packs and emergency supplies to families affected by severe flooding and strong winds.",
        peopleHelped: "2,450+ individuals",
        location: "Davao Region",
    },
    {
        title: "Flood Evacuation Support",
        description:
            "Provided temporary shelter assistance and basic needs for displaced communities during heavy flooding.",
        peopleHelped: "1,800+ individuals",
        location: "Mindanao Areas",
    },
    {
        title: "Earthquake Response Aid",
        description:
            "Delivered essential kits and medical support to affected barangays after seismic activity.",
        peopleHelped: "3,120+ individuals",
        location: "Southern Philippines",
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

    /* 🌊 PARALLAX DRIVER */
    const [scrollY, setScrollY] = useState(0);

    const requireAuth = (path: string) => {
        if (isAuthenticated) navigate(path);
        else {
            setPendingRoute(path);
            setLoginOpen(true);
        }
    };

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    /* ---------------- SCROLL SYSTEM ---------------- */
    useEffect(() => {
        const sectionIds = [
            "home",
            "social-responsibility",
            "results",
            "about-us",
        ];

        const onScroll = () => {
            const y = window.scrollY;

            setIsScrolled(y > 40);
            setIsCompact(y > 80);

            /* 🌊 parallax driver */
            setScrollY(y);
        };

        window.addEventListener("scroll", onScroll);
        onScroll();

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort(
                        (a, b) =>
                            b.intersectionRatio - a.intersectionRatio
                    );

                if (visible.length > 0) {
                    setActiveSection(visible[0].target.id);
                }
            },
            {
                threshold: [0.2, 0.5, 0.8],
                rootMargin: "-20% 0px -50% 0px",
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
        <div className="min-h-screen overflow-x-hidden text-gray-800 bg-gradient-to-br from-[#FBF9F1] to-[#E5E1DA]">
            <LoginModal
                open={loginOpen}
                onClose={() => setLoginOpen(false)}
                onSuccess={() => {
                    setLoginOpen(false);
                    navigate(pendingRoute || "/dashboard");
                }}
            />

            {/* HEADER */}
            <header
                className={`fixed top-0 left-0 z-50 w-full backdrop-blur-xl border-b transition-all duration-500 ${
                    isScrolled
                        ? "bg-transparent border-white/20"
                        : "bg-white/40 border-white/30"
                }`}
            >
                <div
                    className={`mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-8 transition-all duration-500 ${
                        isCompact ? "py-2" : "py-5"
                    }`}
                >
                    <span
                        className={`text-white font-semibold rounded-2xl shadow-lg flex items-center transition-all ${
                            isCompact ? "px-4 h-9 text-sm" : "px-5 h-12"
                        }`}
                        style={{
                            background:
                                "linear-gradient(135deg,#92C7CF,#AAD7D9)",
                        }}
                    >
                        Hexaprime Inc.
                    </span>

                    <nav className="hidden md:flex gap-7 text-sm font-semibold">
                        {[
                            "home",
                            "social-responsibility",
                            "results",
                            "about-us",
                        ].map((id) => (
                            <button
                                key={id}
                                onClick={() => scrollToSection(id)}
                                className={navItemClass(id)}
                            >
                                {id.replace("-", " ")}
                            </button>
                        ))}
                    </nav>

                    <button
                        onClick={() => requireAuth("/dashboard")}
                        className={`rounded-2xl font-semibold text-sm transition-all bg-white/40 border border-white/50 ${
                            isCompact ? "px-4 h-9" : "px-5 h-10"
                        }`}
                    >
                        Log In <ArrowRight className="inline h-4 w-4" />
                    </button>
                </div>
            </header>

            <main className="pt-[88px]">
                {/* 🌊 PARALLAX HERO */}
                <section
                    id="home"
                    className="relative mx-auto grid min-h-[95vh] max-w-7xl items-center gap-14 px-6 lg:grid-cols-2 lg:px-8 overflow-hidden"
                >
                    {/* BACKGROUND LAYERS */}
                    <div
                        className="absolute inset-0 -z-10"
                        style={{
                            transform: `translateY(${scrollY * 0.15}px)`,
                        }}
                    >
                        <div className="absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-[#92C7CF]/30 blur-3xl" />
                        <div className="absolute top-40 right-[-100px] h-[500px] w-[500px] rounded-full bg-[#AAD7D9]/30 blur-3xl" />
                    </div>

                    {/* TEXT LAYER */}
                    <div
                        style={{
                            transform: `translateY(${scrollY * 0.08}px)`,
                        }}
                        className="max-w-3xl"
                    >
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
                                        "linear-gradient(135deg,#5f9da7,#92C7CF,#AAD7D9)",
                                }}
                            >
                                with Hexaprime
                            </span>
                        </h1>

                        <p className="mt-6 text-lg text-gray-600">
                            Transparent STL systems with community-driven impact across the Philippines.
                        </p>
                    </div>

                    {/* IMAGE LAYER */}
                    <div
                        style={{
                            transform: `translateY(${-scrollY * 0.05}px) scale(${1 + scrollY * 0.0001})`,
                        }}
                        className="relative"
                    >
                        <div className="rounded-[2.5rem] border border-white/40 bg-white/30 p-3 backdrop-blur-xl shadow-2xl">
                            <img
                                src={heroImage}
                                className="rounded-[2rem] w-full object-cover"
                            />
                        </div>

                        <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-[#92C7CF]/30 blur-3xl" />
                    </div>
                </section>

                {/* SOCIAL RESPONSIBILITY */}
                <section
                    id="social-responsibility"
                    className="mx-auto max-w-7xl px-6 py-20"
                >
                    <div className="rounded-[3rem] bg-white/30 border border-white/40 backdrop-blur-xl p-12">
                        <h2 className="text-4xl font-bold">
                            Social Responsibility
                        </h2>

                        <div className="mt-10 grid md:grid-cols-3 gap-6">
                            {socialImpact.map((item) => (
                                <div
                                    key={item.title}
                                    className="p-6 rounded-3xl bg-white/40 border border-white/50 backdrop-blur-xl"
                                >
                                    <h3 className="font-semibold text-lg">
                                        {item.title}
                                    </h3>
                                    <p className="text-sm mt-3 text-gray-600">
                                        {item.description}
                                    </p>
                                    <p className="mt-4 text-sm">
                                        <b>People Helped:</b>{" "}
                                        {item.peopleHelped}
                                    </p>
                                    <p className="text-sm">
                                        <b>Location:</b> {item.location}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* RESULTS */}
                <section id="results" className="mx-auto max-w-7xl px-6 py-20">
                    <h2 className="text-4xl font-bold">Results</h2>
                </section>

                {/* ABOUT */}
                <section id="about-us" className="mx-auto max-w-7xl px-6 py-20">
                    <h2 className="text-4xl font-bold">About Us</h2>
                </section>
            </main>
        </div>
    );
}