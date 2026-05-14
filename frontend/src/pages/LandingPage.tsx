import { useEffect, useState, useCallback } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Shield,
  Heart,
  Users,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import heroImage from "../assets/hero.png";
import { useAuth } from "../context/AuthContext";
import LoginModal from "../components/LoginModal";

/* ---------------- SLIDESHOW IMAGES ---------------- */
const slideshowImages = [
  "/slideshow/slide1.jpg",
  "/slideshow/slide2.jpg",
  "/slideshow/slide3.jpg",
  "/slideshow/slide4.jpg",
  "/slideshow/slide5.jpg",
];

/* ---------------- DATA ---------------- */
interface ImpactItem {
  title: string;
  description: string;
  peopleHelped: string;
  location: string;
  icon: React.ElementType;
}

const socialImpact: ImpactItem[] = [
  {
    title: "Typhoon Relief Operations",
    description:
      "Distributed food packs and emergency supplies to families affected by severe flooding and strong winds.",
    peopleHelped: "2,450+ individuals",
    location: "Davao Region",
    icon: Heart,
  },
  {
    title: "Flood Evacuation Support",
    description:
      "Provided temporary shelter assistance and basic needs for displaced communities during heavy flooding.",
    peopleHelped: "1,800+ individuals",
    location: "Mindanao Areas",
    icon: Users,
  },
  {
    title: "Earthquake Response Aid",
    description:
      "Delivered essential kits and medical support to affected barangays after seismic activity.",
    peopleHelped: "3,120+ individuals",
    location: "Southern Philippines",
    icon: Shield,
  },
];

const stats = [
  { label: "Communities Served", value: "120+" },
  { label: "Individuals Helped", value: "7,370+" },
  { label: "Years of Service", value: "8+" },
  { label: "Partner LGUs", value: "15+" },
];

/* ---------------- HOOKS ---------------- */
const useIntersectionObserver = (ids: string[]) => {
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible((prev) => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [ids]);

  return visible;
};

const useSlideshow = (images: string[], interval = 5000) => {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [next, interval]);

  return { current, next, prev, setCurrent };
};

/* ---------------- COMPONENT ---------------- */
export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const slide = useSlideshow(slideshowImages, 4500);

  const inView = useIntersectionObserver([
    "hero",
    "social-responsibility",
    "results",
    "about-us",
  ]);

  const navItems = [
    { id: "hero", label: "Home" },
    { id: "social-responsibility", label: "Social Responsibility" },
    { id: "results", label: "Results" },
    { id: "about-us", label: "About Us" },
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  const requireAuth = (path: string) => {
    if (isAuthenticated) navigate(path);
    else {
      setPendingRoute(path);
      setLoginOpen(true);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans antialiased text-gray-900">
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          setLoginOpen(false);
          navigate(pendingRoute || "/dashboard");
        }}
      />

      {/* ─── HEADER ─── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          {/* Logo */}
          <span className="text-lg font-bold tracking-tight text-gray-900">
            Hexaprime<span className="text-blue-500">.</span>
          </span>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => requireAuth("/dashboard")}
              className="ml-4 inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-all"
            >
              Dashboard <ArrowRight className="h-4 w-4" />
            </button>
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2 font-medium"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => requireAuth("/dashboard")}
              className="w-full rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-all"
            >
              Dashboard
            </button>
          </div>
        )}
      </header>

      <main>
        {/* ─── HERO / SLIDESHOW ─── */}
        <section
          id="hero"
          className="relative min-h-screen flex items-center overflow-hidden bg-gray-50"
        >
          {/* Background slideshow */}
          <div className="absolute inset-0">
            {slideshowImages.map((src, i) => (
              <div
                key={src}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  i === slide.current ? "opacity-100" : "opacity-0"
                }`}
              >
                <img
                  src={src}
                  alt={`Slide ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/40 to-transparent" />
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 w-full">
            <div
              className={`max-w-2xl transition-all duration-700 ${
                inView.hero
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold tracking-wider text-gray-700 border border-gray-200">
                <Shield className="h-3.5 w-3.5 text-blue-500" />
                Small Town Lottery
              </span>

              <h1 className="mt-8 text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-gray-900">
                Sharing Care,{" "}
                <span className="text-blue-500">Beyond the Line</span>{" "}
                With Hexaprime
              </h1>

              <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-lg">
                Building secure, transparent STL systems that uplift communities
                across the Philippines through responsible gaming and social
                responsibility.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={() => scrollTo("social-responsibility")}
                  className="rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/10"
                >
                  Learn More
                </button>
                <button
                  onClick={() => requireAuth("/dashboard")}
                  className="rounded-full border border-gray-300 bg-white/60 backdrop-blur-sm px-7 py-3 text-sm font-semibold text-gray-800 hover:bg-white hover:border-gray-400 transition-all"
                >
                  Dashboard <ArrowRight className="inline h-4 w-4 ml-1" />
                </button>
              </div>
            </div>
          </div>

          {/* Slideshow controls */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
            <button
              onClick={slide.prev}
              className="rounded-full bg-white/70 backdrop-blur-sm p-2 text-gray-700 hover:bg-white transition-all shadow-sm"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex gap-2">
              {slideshowImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => slide.setCurrent(i)}
                  className={`rounded-full transition-all ${
                    i === slide.current
                      ? "bg-gray-900 w-8 h-2"
                      : "bg-gray-400 w-2 h-2 hover:bg-gray-600"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={slide.next}
              className="rounded-full bg-white/70 backdrop-blur-sm p-2 text-gray-700 hover:bg-white transition-all shadow-sm"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* ─── SOCIAL RESPONSIBILITY ─── */}
        <section
          id="social-responsibility"
          className="py-24 sm:py-32"
        >
          <div
            className={`mx-auto max-w-7xl px-6 lg:px-8 transition-all duration-700 ${
              inView["social-responsibility"]
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold tracking-[0.2em] text-blue-500 uppercase">
                Our Impact
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
                Social Responsibility
              </h2>
              <p className="mt-4 text-gray-500 leading-relaxed">
                Committed to giving back to the communities we serve through
                meaningful disaster relief and support programs.
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {socialImpact.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="group rounded-2xl border border-gray-100 bg-white p-8 hover:border-gray-200 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                      {item.description}
                    </p>
                    <div className="mt-5 pt-5 border-t border-gray-100 space-y-1">
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Helped:</span>{" "}
                        {item.peopleHelped}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Location:</span>{" "}
                        {item.location}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stats row */}
            <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-gray-50 border border-gray-100 p-6 text-center"
                >
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 font-medium uppercase tracking-wide">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── RESULTS ─── */}
        <section id="results" className="py-24 sm:py-32 bg-gray-50">
          <div
            className={`mx-auto max-w-7xl px-6 lg:px-8 transition-all duration-700 ${
              inView.results
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold tracking-[0.2em] text-blue-500 uppercase">
                Latest Draw
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
                Today's Result
              </h2>
              <p className="mt-4 text-gray-500 leading-relaxed">
                Check the latest winning numbers for our lottery draws.
              </p>
            </div>

                    <div
                        className="relative rounded-sx"
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
                <section id="results">
                    {/* Results content */}
                </section>
                <section id="about-us">
                    {/* About Us content */}
                </section>
            </main>
        </div>
    );
}