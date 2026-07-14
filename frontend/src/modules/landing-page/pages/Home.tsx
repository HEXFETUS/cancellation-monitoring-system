import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Shield, Loader2 } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/* ---------------- SLIDESHOW IMAGES ---------------- */
const slideshowImages = [
  "/slideshow/slide1.jpg",
  "/slideshow/slide2.jpg",
  "/slideshow/slide3.jpg",
  "/slideshow/slide4.jpg",
  "/slideshow/slide5.jpg",
];

/* ---------------- TYPES ---------------- */
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

/* ---------------- MEDIA CAROUSEL ---------------- */
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

/* ---------------- HOME COMPONENT ---------------- */
interface HomeProps {
  onOpenLightbox?: (urls: string[], index: number) => void;
}

export default function Home({ onOpenLightbox }: HomeProps) {
  const handleOpenLightbox = onOpenLightbox || (() => {});
  const slide = useSlideshow(slideshowImages, 4500);

  // Announcements from API
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

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

  const sortedAnnouncements = [...announcements]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  return (
    <>
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
              className={`absolute inset-0 transition-opacity duration-1000 ${i === slide.current ? "opacity-100" : "opacity-0"
                }`}
            >
              <img
                src={src}
                alt={`Slide ${i + 1}`}
                className="h-full w-full object-cover"
              />
              {/* Dark overlay for text readability */}
              <div className="absolute inset-0 bg-linear-to-r from-black/50 via-black/25 to-transparent" />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 w-full">
          <div className="max-w-2xl">
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
              Sharing Care Beyond the line with {""}
              <span style={{ color: "#AAD7D9" }}>Hexaprime</span>
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
                onClick={() => document.getElementById('events-news')?.scrollIntoView({ behavior: 'smooth' })}
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

      {/* ─── EVENTS & NEWS (Dynamic from API) ─── */}
      <section id="events-news" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
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
                        onOpen={(urls, index) => handleOpenLightbox(urls, index)}
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
                          <svg className="h-3 w-3" style={{ color: "#92C7CF" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
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
    </>
  );
}