import { useEffect, useState } from "react";
import {
    ArrowRight,
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

/* ---------------- IN VIEW HOOK ---------------- */
const useInView = () => {
    const [visible, setVisible] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    setVisible((prev) => ({
                        ...prev,
                        [entry.target.id]: entry.isIntersecting,
                    }));
                });
            },
            { threshold: 0.15 }
        );

        const ids = ["home", "social-responsibility", "results", "about-us"];

        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, []);

    return visible;
};

export default function LandingPage() {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [loginOpen, setLoginOpen] = useState(false);
    const [pendingRoute, setPendingRoute] = useState<string | null>(null);

    const [isScrolled, setIsScrolled] = useState(false);
    const [isCompact, setIsCompact] = useState(false);
    const [activeSection, setActiveSection] = useState("home");
    const [scrollY, setScrollY] = useState(0);

    const sectionInView = useInView();

    const navItems = [
        { id: "home", label: "Home" },
        { id: "social-responsibility", label: "Social Responsibility" },
        { id: "results", label: "Results" },
        { id: "about-us", label: "About Us" },
    ];

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

    const sectionAnim = (id: string) =>
        `transition-all duration-700 ease-out ${
            sectionInView[id]
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
        }`;

    const navItemClass = (id: string) =>
        `transition-colors ${
            activeSection === id
                ? "text-gray-900 font-semibold"
                : "text-gray-600 hover:text-gray-900"
        }`;

    /* ---------------- SCROLL + OBSERVER ---------------- */
    useEffect(() => {
        const sectionIds = navItems.map((n) => n.id);

        const onScroll = () => {
            const y = window.scrollY;
            setIsScrolled(y > 30);
            setIsCompact(y > 70);
            setScrollY(y);
        };

        window.addEventListener("scroll", onScroll);
        onScroll();

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

                if (visible.length) {
                    setActiveSection(visible[0].target.id);
                }
            },
            {
                threshold: [0.2, 0.5, 0.8],
                rootMargin: "-20% 0px -45% 0px",
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

    return (
        <div className="min-h-screen overflow-x-hidden text-gray-800 bg-gradient-to-br from-[#FBF9F1] to-[#E5E1DA] no-scrollbar">
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
                className={`fixed top-0 left-0 z-50 w-full backdrop-blur-xl border-b transition-all duration-300 ${
                    isScrolled
                        ? "bg-transparent border-white/20"
                        : "bg-white/40 border-white/30"
                }`}
            >
                <div
                    className={`mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-8 ${
                        isCompact ? "py-2" : "py-4"
                    }`}
                >
                    <span
                        className="text-white font-semibold rounded-2xl shadow-lg flex items-center px-4 h-10 text-sm"
                        style={{
                            background:
                                "linear-gradient(135deg,#92C7CF,#AAD7D9)",
                        }}
                    >
                        Hexaprime Inc.
                    </span>

                    <nav className="hidden md:flex gap-6 text-sm font-semibold">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => scrollToSection(item.id)}
                                className={navItemClass(item.id)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    <button
                        onClick={() => requireAuth("/dashboard")}
                        className="px-4 h-10 rounded-2xl text-sm font-semibold bg-white/40 border border-white/50"
                    >
                        Log In <ArrowRight className="inline h-4 w-4" />
                    </button>
                </div>
            </header>

            <main className="pt-[76px]">
                {/* HERO */}
                <section
                    id="home"
                    className={`relative mx-auto grid min-h-[88vh] max-w-7xl items-center gap-10 px-6 lg:grid-cols-2 lg:px-8 overflow-hidden ${sectionAnim(
                        "home"
                    )}`}
                >
                    <div
                        className="absolute inset-0 -z-10"
                        style={{ transform: `translateY(${scrollY * 0.12}px)` }}
                    >
                        <div className="absolute -top-24 -left-24 h-[320px] w-[320px] rounded-full bg-[#92C7CF]/30 blur-3xl" />
                        <div className="absolute top-32 right-[-80px] h-[420px] w-[420px] rounded-full bg-[#AAD7D9]/30 blur-3xl" />
                    </div>

                    <div
                        style={{
                            transform: `translateY(${scrollY * 0.06}px)`,
                        }}
                    >
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/50 px-4 py-2 text-xs font-semibold tracking-[0.15em] text-gray-600 backdrop-blur-md">
                            <ShieldCheck className="h-4 w-4 text-[#5f9da7]" />
                            Small Town Lottery
                        </div>

                        <h1 className="mt-5 text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
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

                        <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
                            Delivering transparent, secure, and community-driven
                            lottery systems across the Philippines.
                        </p>
                    </div>

                    <div
                        style={{
                            transform: `translateY(${-scrollY * 0.04}px)`,
                        }}
                    >
                        <div className="rounded-[2.5rem] border border-white/40 bg-white/30 p-3 backdrop-blur-xl shadow-2xl">
                            <img
                                src={heroImage}
                                alt="Hero"
                                className="rounded-[2rem] w-full object-cover"
                            />
                        </div>
                    </div>
                </section>

                {/* SOCIAL */}
                <section
                    id="social-responsibility"
                    className={`mx-auto max-w-7xl px-6 py-4 ${sectionAnim(
                        "social-responsibility"
                    )}`}
                >
                    <div className="rounded-[2.5rem] bg-white/30 border border-white/40 backdrop-blur-xl p-10">
                        <h2 className="text-3xl font-bold">
                            Social Responsibility
                        </h2>

                        <div className="mt-8 grid md:grid-cols-3 gap-6">
                            {socialImpact.map((item) => (
                                <div
                                    key={item.title}
                                    className="p-6 rounded-2xl bg-white/40 border border-white/50"
                                >
                                    <h3 className="font-semibold">
                                        {item.title}
                                    </h3>

                                    <p className="text-sm mt-3 text-gray-600">
                                        {item.description}
                                    </p>

                                    <p className="mt-3 text-sm">
                                        <b>Helped:</b> {item.peopleHelped}
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
                <section
                    id="results"
                    className={`mx-auto max-w-7xl px-6 py-4 ${sectionAnim(
                        "results"
                    )}`}
                >
                    <div className="rounded-[2.5rem] border border-white/40 bg-white/30 backdrop-blur-xl p-10">
                        <h2 className="text-3xl font-bold">Today's Result</h2>

                        <div className="mt-8 grid md:grid-cols-2 gap-6">
                            {[
                                ["3D", "128"],
                                ["STL", "143"],
                            ].map(([label, value]) => (
                                <div
                                    key={label}
                                    className="p-6 rounded-2xl bg-white/40 border border-white/50"
                                >
                                    <p className="text-sm text-gray-600">
                                        {label}
                                    </p>

                                    <p className="text-3xl font-bold mt-2">
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ABOUT */}
                <section
                    id="about-us"
                    className={`mx-auto max-w-7xl px-6 py-4 ${sectionAnim(
                        "about-us"
                    )}`}
                >
                    <div className="rounded-[2.5rem] border border-white/40 bg-white/30 backdrop-blur-xl p-10">
                        <h2 className="text-3xl font-bold">
                            About Hexaprime
                        </h2>

                        <p className="mt-4 text-gray-600 text-sm leading-6 max-w-3xl">
                            Hexaprime Inc. builds secure and transparent STL
                            systems across the Philippines while supporting
                            communities through social responsibility programs
                            and humanitarian initiatives.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}