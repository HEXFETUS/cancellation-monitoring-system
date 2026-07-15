import { useEffect, useState, useCallback, useRef } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Shield,
  Heart,
  Users,
  TrendingUp,
  MapPin,
  Loader2,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import LoginModal from "../../../components/LoginModal";
import LogoWithName from "../../../assets/LogoWithName.webp";
import LogoOnly from "../../../assets/LogoOnly.webp";
import { fetchLandingPageContent } from "../services/landingPage";

/* Default hero copy (kept in sync with the live landing page) used as a
   fallback until the Home section has been saved via the admin editor. */
const DEFAULT_HERO_TITLE = "Sharing Care Beyond the line with Hexaprime";
const DEFAULT_HERO_DESCRIPTION =
  "Building secure, transparent STL systems that uplift communities across the Philippines through responsible gaming and social responsibility.";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/* ---------------- COLOR PALETTE ---------------- */
/* 
  #92C7CF  – primary teal
  #AAD7D9  – light teal  
  #FBF9F1  – cream bg
  #E5E1DA  – warm gray
*/

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
  { label: "Years of Service", value: "3+" },
  { label: "Partner LGUs", value: "15+" },
];

/* ---------------- TYPES ---------------- */
interface LotteryResult {
  id: number;
  draw_label: string;
  winning_number: string;
  area: string;
  draw_date: string;
  game_type: string;
}

interface Announcement {
  id: number;
  title: string | null;
  caption: string;
  type: "event" | "news";
  media_urls: string[];
  location: string;
  created_at: string;
}

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
    if (images.length <= 1) return;
    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [images.length, next, interval]);

  return { current, next, prev, setCurrent };
};

/* ---------------- MEDIA CAROUSEL (single photo + prev/next) ---------------- */
function MediaCarousel({
  urls,
  alt,
  onOpen,
  apiBase,
}: {
  urls: string[];
  alt: string;
  onOpen: (urls: string[], index: number) => void;
  apiBase: string;
}) {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, urls.length - 1);
  const current = urls[safeIndex];
  const isVideo = /\.mp4$/i.test(current);
  const fullUrl = `${apiBase}${current}`;
  const hasMultiple = urls.length > 1;

  const go = (dir: number) => {
    setIndex((prev) => (prev + dir + urls.length) % urls.length);
  };

  return (
    <div className="relative bg-gray-100">
      <button
        type="button"
        onClick={() => onOpen(urls, safeIndex)}
        className="block w-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal"
      >
        {isVideo ? (
          <video
            src={fullUrl}
            preload="metadata"
            className="w-full h-auto max-h-96 object-contain bg-gray-100"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(urls, safeIndex);
            }}
          />
        ) : (
          <img
            src={fullUrl}
            alt={`${alt} (${safeIndex + 1}/${urls.length})`}
            className="w-full h-auto max-h-96 object-contain bg-gray-100"
          />
        )}
      </button>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white transition hover:bg-black/60"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white transition hover:bg-black/60"
            aria-label="Next photo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {urls.map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: i === safeIndex ? "white" : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- COMPONENT ---------------- */
export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Results from API
  const [results, setResults] = useState<LotteryResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);

  // Announcements from API
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  // Media lightbox
  const [lightboxState, setLightboxState] = useState<{ urls: string[]; index: number } | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const closeMedia = useCallback(() => setLightboxState(null), []);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMedia(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closeMedia]);
  useEffect(() => {
    if (lightboxState) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxState]);

  // Hero content from API (falls back to the existing landing-page design).
  const [heroTitle, setHeroTitle] = useState(DEFAULT_HERO_TITLE);
  const [heroDescription, setHeroDescription] = useState(DEFAULT_HERO_DESCRIPTION);
  const [savedHeroMedia, setSavedHeroMedia] = useState<string[]>([]);
  const heroMedia = savedHeroMedia.length > 0
    ? savedHeroMedia.map((url) => `${API_BASE}${url}`)
    : slideshowImages;
  const slide = useSlideshow(heroMedia, 4500);
  const currentHeroIndex = slide.current % heroMedia.length;

  const loadHero = useCallback(async () => {
    try {
      const data = await fetchLandingPageContent("home");
      if (data) {
        setHeroTitle(data.title || DEFAULT_HERO_TITLE);
        setHeroDescription(data.description || DEFAULT_HERO_DESCRIPTION);
        setSavedHeroMedia((data.image_urls || []).slice(0, 5));
      } else {
        setHeroTitle(DEFAULT_HERO_TITLE);
        setHeroDescription(DEFAULT_HERO_DESCRIPTION);
        setSavedHeroMedia([]);
      }
    } catch {
      console.error("Failed to fetch home content");
    }
  }, []);

  useEffect(() => {
    loadHero();
  }, [loadHero]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadHero();
    };
    const onFocus = () => loadHero();

    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadHero]);

  const location = useLocation();

  const inView = useIntersectionObserver([
    "hero",
    "social-responsibility",
    "results",
    "events-news",
    "about-us",
  ]);

  useEffect(() => {
    if (location.pathname === "/") {
      loadHero();
    }
  }, [location.pathname, loadHero]);

  const navItems = [
    { id: "hero", label: "Home" },
    { id: "events-news", label: "Events & News" },
    { id: "results", label: "Results" },
    { id: "social-responsibility", label: "Social Responsibility" },
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

  // Fetch results
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/posts/results`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        console.error("Failed to fetch results");
      } finally {
        setResultsLoading(false);
      }
    })();
  }, []);

  // Fetch Events & News posts
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/events-news`);
        if (res.ok) {
          const data = await res.json();
          setAnnouncements(data);
        }
      } catch {
        console.error("Failed to fetch events & news");
      } finally {
        setAnnouncementsLoading(false);
      }
    })();
  }, []);

  // Group results by area
  const resultsByArea: Record<string, LotteryResult[]> = {};
  results.forEach((r) => {
    if (!resultsByArea[r.area]) resultsByArea[r.area] = [];
    resultsByArea[r.area].push(r);
  });

  const stlCdoByTime = new Map<string, LotteryResult>();
  const stlMisorByTime = new Map<string, LotteryResult>();
  const threeDByTime = new Map<string, LotteryResult>();

  const timeFromLabel = (label: string) => label.replace(/^(STL|3D)\s*/, "").trim();

  results.forEach((r) => {
    const t = timeFromLabel(r.draw_label);
    if (r.game_type === "STL" && r.area === "Local CDO") {
      stlCdoByTime.set(t, r);
    } else if (r.game_type === "STL" && r.area === "Local MISOR") {
      stlMisorByTime.set(t, r);
    } else if (r.game_type === "3D") {
      threeDByTime.set(t, r);
    }
  });

  const stlTimes = ["11AM", "4PM", "8PM"];
  const threeDTimes = ["1PM", "5PM", "9PM"];

  const todayDrawDate =
    results.length > 0
      ? new Date(results[0].draw_date).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

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
          navigate(pendingRoute || "/app/dashboard");
        }}
      />

      {/* ─── HEADER ─── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
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
              className={`transition-all duration-300 ${scrolled ? "h-8 w-auto" : "h-10 w-auto"
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
              onClick={() => requireAuth("/app/dashboard")}
              className="ml-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all"
              style={{
                backgroundColor: scrolled ? "#92C7CF" : "rgba(146, 199, 207, 0.9)",
                color: scrolled ? "#1a2e32" : "white",
                boxShadow: scrolled
                  ? "0 2px 8px rgba(146, 199, 207, 0.3)"
                  : "0 2px 8px rgba(0,0,0,0.15)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#7db8c0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = scrolled
                  ? "#92C7CF"
                  : "rgba(146, 199, 207, 0.9)";
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
              onClick={() => {
                setMobileOpen(false);
                requireAuth("/app/dashboard");
              }}
              className="w-full rounded-xs px-5 py-2.5 text-sm font-semibold text-white transition-all"
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
            {heroMedia.map((src, i) => (
              <div
                key={src}
                className={`absolute inset-0 transition-opacity duration-1000 ${i === currentHeroIndex ? "opacity-100" : "opacity-0"
                  }`}
              >
                {/\.mp4(?:$|\?)/i.test(src) ? (
                  <video
                    src={src}
                    className="h-full w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    aria-label={`Hero video ${i + 1}`}
                  />
                ) : (
                  <img
                    src={src}
                    alt={`Hero media ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                )}
                {/* Dark overlay for text readability */}
                <div className="absolute inset-0 bg-linear-to-r from-black/50 via-black/25 to-transparent" />
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 w-full">
            <div
              className={`max-w-2xl transition-all duration-700 ${inView.hero
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
                {heroTitle.split(/(Hexaprime)/).map((part, i) =>
                  part === "Hexaprime" ? (
                    <span key={i} style={{ color: "#AAD7D9" }}>{part}</span>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </h1>

              <p
                className="mt-5 text-base sm:text-lg leading-relaxed max-w-lg"
                style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 6px rgba(0,0,0,0.2)" }}
              >
                {heroDescription}
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
              </div>
            </div>
          </div>

          {/* Slideshow controls */}
          {heroMedia.length > 1 && (
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
              {heroMedia.map((_, i) => (
                <button
                  key={i}
                  onClick={() => slide.setCurrent(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: i === currentHeroIndex ? "32px" : "8px",
                    height: "8px",
                    backgroundColor:
                      i === currentHeroIndex ? "#92C7CF" : "rgba(255,255,255,0.5)",
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
          )}
        </section>

        {/* ─── EVENTS & NEWS (Dynamic from API) ─── */}
        <section id="events-news" className="py-24 sm:py-32">
          <div
            className={`mx-auto max-w-7xl px-6 lg:px-8 transition-all duration-700 ${inView["events-news"]
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-10"
              }`}
          >
            <div className="mx-auto max-w-2xl text-center">
              <span
                className="text-xs font-semibold tracking-[0.2em] uppercase"
                style={{ color: "#92C7CF" }}
              >
                Stay Updated
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-800">
                Events & News
              </h2>
              <p className="mt-4 leading-relaxed" style={{ color: "#6b6b6b" }}>
                Latest announcements, community events, and updates from Hexaprime.
              </p>
            </div>

            {(() => {
              if (announcementsLoading) {
                return (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#92C7CF" }} />
                  </div>
                );
              }

              const sortedAnnouncements = [...announcements]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 4);

              if (sortedAnnouncements.length === 0) {
                return (
                  <p className="mt-12 text-center text-sm" style={{ color: "#999" }}>
                    No posts yet. Check back later.
                  </p>
                );
              }

              return (
                <div className="mt-16 mx-auto max-w-[1400px] grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {sortedAnnouncements.map((item) => (
                    <article
                      key={item.id}
                      className="group rounded-2xl overflow-hidden transition-all duration-300 bg-white"
                      style={{
                        border: "1px solid #E5E1DA",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#92C7CF";
                        e.currentTarget.style.boxShadow = "0 12px 40px rgba(146, 199, 207, 0.18)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E5E1DA";
                        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      {/* Media hero — single-photo carousel */}
                      {item.media_urls.length > 0 && (
                        <MediaCarousel
                          urls={item.media_urls}
                          alt={item.title || "Events & News media"}
                          onOpen={(urls, index) => setLightboxState({ urls, index })}
                          apiBase={API_BASE}
                        />
                      )}

                      {/* Content */}
                      <div className="p-4 sm:p-5 text-center">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                            style={{
                              backgroundColor:
                                item.type === "event"
                                  ? "rgba(146, 199, 207, 0.1)"
                                  : "rgba(229, 225, 218, 0.4)",
                              color:
                                item.type === "event" ? "#92C7CF" : "#8a8a8a",
                            }}
                          >
                            {item.type === "event" ? "Event" : "News"}
                          </span>
                          <span className="text-[11px]" style={{ color: "#999" }}>
                            {new Date(item.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>

                        {item.title && (
                          <h3 className="mt-2 text-base font-semibold text-gray-800 leading-snug line-clamp-2">
                            {item.title}
                          </h3>
                        )}

                        <p className="mt-1.5 text-xs leading-snug whitespace-pre-line" style={{ color: "#6b6b6b" }}>
                          {item.caption.split(/(#\w+)/g).map((part, i) => 
                            part.startsWith('#') ? (
                              <span key={i} className="font-medium" style={{ color: "#92C7CF" }}>{part}</span>
                            ) : (
                              part
                            )
                          )}
                        </p>

                        {item.location && (
                          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px]" style={{ color: "#999" }}>
                            <MapPin className="h-3 w-3" style={{ color: "#92C7CF" }} />
                            {item.location}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              );
            })()}
          </div>
        </section>

        {/* ─── RESULTS (Dynamic from API) ─── */}
        <section id="results" className="py-24 sm:py-32" style={{ backgroundColor: "#E5E1DA" }}>
          <div
            className={`mx-auto max-w-7xl px-6 lg:px-8 transition-all duration-700 ${inView.results
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
              <div className="mt-4 inline-block">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-base font-bold tracking-wide"
                  style={{
                    backgroundColor: "rgba(146, 199, 207, 0.15)",
                    color: "#2a5a5a",
                    border: "1.5px solid rgba(146, 199, 207, 0.3)",
                  }}
                >
                  <svg className="h-5 w-5" style={{ color: "#92C7CF" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {todayDrawDate}
                </span>
              </div>
              <p className="mt-4 leading-relaxed" style={{ color: "#6b6b6b" }}>
                Check the latest winning numbers for our lottery draws.
              </p>
            </div>

            {resultsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#92C7CF" }} />
              </div>
            ) : results.length === 0 ? (
              <p className="mt-12 text-center text-sm" style={{ color: "#999" }}>
                No results posted yet. Check back later.
              </p>
            ) : (
              <div className="mt-12 space-y-6 max-w-5xl mx-auto">
                {/* STL CDO Row */}
                <div className="rounded-2xl overflow-hidden bg-white shadow-lg transition-all duration-300 hover:shadow-xl" style={{ border: "1.5px solid #E5E1DA" }}>
                  <div className="px-4 py-2.5 text-center" style={{ background: "linear-gradient(135deg, rgba(146, 199, 207, 0.25) 0%, rgba(146, 199, 207, 0.12) 100%)", borderBottom: "1.5px solid #E5E1DA" }}>
                    <span className="text-lg font-bold tracking-wider" style={{ color: "#2a5a5a" }}>
                      STL CDO
                    </span>
                  </div>
                  <div className="grid grid-cols-3">
                    {stlTimes.map((time) => {
                      const result = stlCdoByTime.get(time);
                      return (
                        <div key={time} className="px-3 py-4 text-center border-r last:border-r-0 transition-colors duration-200 hover:bg-gray-50/50" style={{ borderColor: "#E5E1DA" }}>
                          <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "#92C7CF" }}>
                            {time.replace("AM", " AM").replace("PM", " PM")}
                          </p>
                          {result ? (
                            <p className="text-2xl sm:text-xl font-black tracking-tight" style={{ color: "#2a4a4a", textShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
                              {result.winning_number}
                            </p>
                          ) : (
                            <p className="text-sm" style={{ color: "#bbb" }}>—</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* STL MISOR Row */}
                <div className="rounded-2xl overflow-hidden bg-white shadow-lg transition-all duration-300 hover:shadow-xl" style={{ border: "1.5px solid #E5E1DA" }}>
                  <div className="px-4 py-2.5 text-center" style={{ background: "linear-gradient(135deg, rgba(232, 168, 56, 0.22) 0%, rgba(232, 168, 56, 0.10) 100%)", borderBottom: "1.5px solid #E5E1DA" }}>
                    <span className="text-lg font-bold tracking-wider" style={{ color: "#7a4a0a" }}>
                      STL MISOR
                    </span>
                  </div>
                  <div className="grid grid-cols-3">
                    {stlTimes.map((time) => {
                      const result = stlMisorByTime.get(time);
                      return (
                        <div key={time} className="px-3 py-4 text-center border-r last:border-r-0 transition-colors duration-200 hover:bg-gray-50/50" style={{ borderColor: "#E5E1DA" }}>
                          <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "#d97706" }}>
                            {time.replace("AM", " AM").replace("PM", " PM")}
                          </p>
                          {result ? (
                            <p className="text-2xl sm:text-xl font-black tracking-tight" style={{ color: "#5a3a1a", textShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
                              {result.winning_number}
                            </p>
                          ) : (
                            <p className="text-sm" style={{ color: "#bbb" }}>—</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3D Row */}
                <div className="rounded-2xl overflow-hidden bg-white shadow-lg transition-all duration-300 hover:shadow-xl" style={{ border: "1.5px solid #E5E1DA" }}>
                  <div className="px-4 py-2.5 text-center" style={{ background: "linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.06) 100%)", borderBottom: "1.5px solid #E5E1DA" }}>
                    <span className="text-lg font-bold tracking-wider" style={{ color: "#4a2a5a" }}>
                      3D
                    </span>
                  </div>
                  <div className="grid grid-cols-3">
                    {threeDTimes.map((time) => {
                      const result = threeDByTime.get(time);
                      return (
                        <div key={time} className="px-3 py-4 text-center border-r last:border-r-0 transition-colors duration-200 hover:bg-gray-50/50" style={{ borderColor: "#E5E1DA" }}>
                          <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "#a855f7" }}>
                            {time.replace("PM", " PM").replace("AM", " AM")}
                          </p>
                          {result ? (
                            <p className="text-2xl sm:text-xl font-black tracking-tight" style={{ color: "#3a2a4a", textShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
                              {result.winning_number}
                            </p>
                          ) : (
                            <p className="text-sm" style={{ color: "#bbb" }}>—</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── SOCIAL RESPONSIBILITY ─── */}
        <section id="social-responsibility" className="py-24 sm:py-32">
          <div
            className={`mx-auto max-w-7xl px-6 lg:px-8 transition-all duration-700 ${inView["social-responsibility"]
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

        {/* ─── ABOUT US ─── */}
        <section id="about-us" className="py-24 sm:py-32">
          <div
            className={`mx-auto max-w-7xl px-6 lg:px-8 transition-all duration-700 ${inView["about-us"]
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

      {/* ─── MEDIA LIGHTBOX ─── */}
      {lightboxState && (
        <div
          ref={lightboxRef}
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={closeMedia}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeMedia}
              className="absolute -top-12 right-0 text-white/80 hover:text-white transition-colors p-1"
              aria-label="Close"
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Previous button */}
            {lightboxState.index > 0 && (
              <button
                onClick={() => setLightboxState(prev => prev ? { ...prev, index: prev.index - 1 } : null)}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60"
                aria-label="Previous image"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Next button */}
            {lightboxState.index < lightboxState.urls.length - 1 && (
              <button
                onClick={() => setLightboxState(prev => prev ? { ...prev, index: prev.index + 1 } : null)}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60"
                aria-label="Next image"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {lightboxState.urls[lightboxState.index]?.match(/\.mp4$/i) ? (
              <video
                src={`${API_BASE}${lightboxState.urls[lightboxState.index]}`}
                controls
                autoPlay
                className="w-full max-h-[85vh] rounded-lg object-contain"
              />
            ) : (
              <img
                src={`${API_BASE}${lightboxState.urls[lightboxState.index]}`}
                alt="Enlarged media"
                className="w-full max-h-[85vh] rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* ─── FOOTER ─── */}
      <footer
        className="border-t py-10"
        style={{ backgroundColor: "#FBF9F1", borderColor: "#E5E1DA" }}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <img src={LogoWithName} alt="Hexaprime" className="h-8 w-auto" />
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
