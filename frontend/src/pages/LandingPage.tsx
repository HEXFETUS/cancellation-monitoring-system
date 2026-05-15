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
import { useAuth } from "../context/AuthContext";
import LoginModal from "../components/LoginModal";
import LogoWithName from "../assets/LogoWithName.webp";
import LogoOnly from "../assets/LogoOnly.webp";

/* ---------------- COLOR PALETTE ---------------- */
/* 
  #92C7CF  – primary teal
  #AAD7D9  – light teal  
  #FBF9F1  – cream bg
  #E5E1DA  – warm gray
*/

/* ---------------- SLIDESHOW IMAGES ---------------- */
const slideshowImages = [
  "/slideshow/slide1.png",
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
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="min-h-screen font-sans antialiased"
      style={{ backgroundColor: "#FBF9F1", color: "#4a4a4a" }}
    >
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
            ? "py-2 shadow-lg"
            : "py-4"
        }`}
        style={{
          backgroundColor: scrolled ? "rgba(251, 249, 241, 0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(229, 225, 218, 0.6)" : "none",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-8">
          {/* Logo: switches on scroll */}
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("hero");
            }}
          >
            <img
              src={scrolled ? LogoOnly : LogoWithName}
              alt="Hexaprime"
              className={`transition-all duration-300 ${
                scrolled ? "h-8 w-auto" : "h-10 w-auto"
              }`}
            />
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="transition-colors duration-200 font-medium"
                style={{
                  color: scrolled ? "#4a4a4a" : "white",
                  textShadow: scrolled ? "none" : "0 1px 3px rgba(0,0,0,0.3)",
                }}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => requireAuth("/dashboard")}
              className="ml-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all"
              style={{
                backgroundColor: scrolled ? "#92C7CF" : "rgba(146, 199, 207, 0.9)",
                color: scrolled ? "#1a2e32" : "white",
                boxShadow: scrolled ? "0 2px 8px rgba(146, 199, 207, 0.3)" : "0 2px 8px rgba(0,0,0,0.15)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#7db8c0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = scrolled ? "#92C7CF" : "rgba(146, 199, 207, 0.9)";
              }}
            >
              Dashboard <ArrowRight className="h-4 w-4" />
            </button>
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: scrolled ? "#4a4a4a" : "white" }}
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
          <div
            className="md:hidden px-6 py-4 space-y-3"
            style={{
              backgroundColor: "#FBF9F1",
              borderTop: "1px solid #E5E1DA",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            }}
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="block w-full text-left py-2 font-medium transition-colors"
                style={{ color: "#4a4a4a" }}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => requireAuth("/dashboard")}
              className="w-full rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all"
              style={{ backgroundColor: "#92C7CF" }}
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
          className="relative min-h-screen flex items-center overflow-hidden"
          style={{ backgroundColor: "#E5E1DA" }}
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
                {/* Dark overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/25 to-transparent" />
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
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider border"
                style={{
                  backgroundColor: "rgba(251, 249, 241, 0.2)",
                  backdropFilter: "blur(8px)",
                  color: "white",
                  borderColor: "rgba(255, 255, 255, 0.2)",
                }}
              >
                <Shield className="h-3.5 w-3.5" style={{ color: "#AAD7D9" }} />
                Small Town Lottery
              </span>

              <h1
                className="mt-8 text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight"
                style={{ color: "white", textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
              >
                Sharing Care Beyond the Line{" "}
                <span style={{ color: "#AAD7D9" }}>with Hexaprime</span>
              </h1>

              <p
                className="mt-5 text-base sm:text-lg leading-relaxed max-w-lg"
                style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 6px rgba(0,0,0,0.2)" }}
              >
                Building secure, transparent STL systems that uplift communities
                across the Philippines through responsible gaming and social
                responsibility.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={() => scrollTo("social-responsibility")}
                  className="rounded-full px-7 py-3 text-sm font-semibold transition-all shadow-lg"
                  style={{
                    backgroundColor: "#92C7CF",
                    color: "#1a2e32",
                    boxShadow: "0 4px 14px rgba(146, 199, 207, 0.35)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#7db8c0";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#92C7CF";
                  }}
                >
                  Learn More
                </button>
                <button
                  onClick={() => requireAuth("/dashboard")}
                  className="rounded-full border px-7 py-3 text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
                    backdropFilter: "blur(8px)",
                    color: "white",
                    borderColor: "rgba(255, 255, 255, 0.3)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
                  }}
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
              className="rounded-full p-2 transition-all shadow-sm"
              style={{
                backgroundColor: "rgba(251, 249, 241, 0.2)",
                backdropFilter: "blur(8px)",
                color: "white",
              }}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex gap-2">
              {slideshowImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => slide.setCurrent(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: i === slide.current ? "32px" : "8px",
                    height: "8px",
                    backgroundColor:
                      i === slide.current ? "#92C7CF" : "rgba(255,255,255,0.5)",
                  }}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={slide.next}
              className="rounded-full p-2 transition-all shadow-sm"
              style={{
                backgroundColor: "rgba(251, 249, 241, 0.2)",
                backdropFilter: "blur(8px)",
                color: "white",
              }}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* ─── SOCIAL RESPONSIBILITY ─── */}
        <section id="social-responsibility" className="py-24 sm:py-32">
          <div
            className={`mx-auto max-w-7xl px-6 lg:px-8 transition-all duration-700 ${
              inView["social-responsibility"]
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            <div className="mx-auto max-w-2xl text-center">
              <span
                className="text-xs font-semibold tracking-[0.2em] uppercase"
                style={{ color: "#92C7CF" }}
              >
                Our Impact
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-800">
                Social Responsibility
              </h2>
              <p className="mt-4 leading-relaxed" style={{ color: "#6b6b6b" }}>
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
                    className="group rounded-2xl p-8 transition-all duration-300"
                    style={{
                      backgroundColor: "white",
                      border: "1px solid #E5E1DA",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#92C7CF";
                      e.currentTarget.style.boxShadow = "0 8px 30px rgba(146, 199, 207, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#E5E1DA";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div
                      className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition-colors"
                      style={{ backgroundColor: "#FBF9F1", color: "#92C7CF" }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed" style={{ color: "#6b6b6b" }}>
                      {item.description}
                    </p>
                    <div className="mt-5 pt-5 space-y-1" style={{ borderTop: "1px solid #E5E1DA" }}>
                      <p className="text-sm">
                        <span className="font-semibold" style={{ color: "#4a4a4a" }}>Helped:</span>{" "}
                        <span style={{ color: "#6b6b6b" }}>{item.peopleHelped}</span>
                      </p>
                      <p className="text-sm">
                        <span className="font-semibold" style={{ color: "#4a4a4a" }}>Location:</span>{" "}
                        <span style={{ color: "#6b6b6b" }}>{item.location}</span>
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
                  className="rounded-xl p-6 text-center"
                  style={{
                    backgroundColor: "rgba(146, 199, 207, 0.08)",
                    border: "1px solid rgba(146, 199, 207, 0.15)",
                  }}
                >
                  <p className="text-2xl sm:text-3xl font-bold" style={{ color: "#92C7CF" }}>
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide" style={{ color: "#6b6b6b" }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── RESULTS ─── */}
        <section id="results" className="py-24 sm:py-32" style={{ backgroundColor: "#E5E1DA" }}>
          <div
            className={`mx-auto max-w-7xl px-6 lg:px-8 transition-all duration-700 ${
              inView.results
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            <div className="mx-auto max-w-2xl text-center">
              <span
                className="text-xs font-semibold tracking-[0.2em] uppercase"
                style={{ color: "#92C7CF" }}
              >
                Latest Draw
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-800">
                Today's Result
              </h2>
              <p className="mt-4 leading-relaxed" style={{ color: "#6b6b6b" }}>
                Check the latest winning numbers for our lottery draws.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
              {[
                { label: "3D", value: "128", desc: "Lucky Pick" },
                { label: "STL", value: "143", desc: "Direct Draw" },
              ].map(({ label, value, desc }) => (
                <div
                  key={label}
                  className="rounded-2xl p-8 text-center transition-all"
                  style={{
                    backgroundColor: "white",
                    border: "1px solid rgba(229, 225, 218, 0.5)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 8px 30px rgba(146, 199, 207, 0.15)";
                    e.currentTarget.style.borderColor = "#92C7CF";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = "rgba(229, 225, 218, 0.5)";
                  }}
                >
                  <span
                    className="text-xs font-semibold tracking-wider uppercase"
                    style={{ color: "#92C7CF" }}
                  >
                    {desc}
                  </span>
                  <p className="mt-1 text-sm font-medium" style={{ color: "#6b6b6b" }}>
                    {label}
                  </p>
                  <p
                    className="mt-3 text-5xl sm:text-6xl font-bold tracking-tight"
                    style={{ color: "#4a4a4a" }}
                  >
                    {value}
                  </p>
                  <p className="mt-4 text-xs" style={{ color: "#999" }}>
                    Draw Date:{" "}
                    {new Date().toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── ABOUT US ─── */}
        <section id="about-us" className="py-24 sm:py-32">
          <div
            className={`mx-auto max-w-7xl px-6 lg:px-8 transition-all duration-700 ${
              inView["about-us"]
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            <div className="mx-auto max-w-3xl text-center">
              <span
                className="text-xs font-semibold tracking-[0.2em] uppercase"
                style={{ color: "#92C7CF" }}
              >
                Who We Are
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-800">
                About Hexaprime
              </h2>
              <p className="mt-6 leading-relaxed text-base sm:text-lg" style={{ color: "#6b6b6b" }}>
                Hexaprime Inc. builds secure and transparent STL systems across
                the Philippines. We are dedicated to providing fair, regulated
                gaming experiences while channeling resources back into
                community development and disaster response initiatives.
              </p>
              <div className="mt-10 flex justify-center gap-3 flex-wrap">
                <div
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                  style={{
                    backgroundColor: "rgba(146, 199, 207, 0.1)",
                    color: "#4a4a4a",
                    border: "1px solid rgba(146, 199, 207, 0.2)",
                  }}
                >
                  <TrendingUp className="h-4 w-4" style={{ color: "#92C7CF" }} />
                  Trusted by 15+ LGUs
                </div>
                <div
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                  style={{
                    backgroundColor: "rgba(146, 199, 207, 0.1)",
                    color: "#4a4a4a",
                    border: "1px solid rgba(146, 199, 207, 0.2)",
                  }}
                >
                  <Shield className="h-4 w-4" style={{ color: "#92C7CF" }} />
                  Fully Compliant
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer
        className="border-t py-10"
        style={{ backgroundColor: "#FBF9F1", borderColor: "#E5E1DA" }}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <img src={LogoOnly} alt="Hexaprime" className="h-8 w-auto" />
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} Hexaprime Inc. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}