import { Heart, Users, Shield } from "lucide-react";

/* ---------------- COLOR PALETTE ---------------- */
/* 
  #92C7CF  – primary teal
  #AAD7D9  – light teal  
  #FBF9F1  – cream bg
  #E5E1DA  – warm gray
*/

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

/* ---------------- COMPONENT ---------------- */
export default function SocialResponsibility() {
  return (
    <>
      {/* ─── SOCIAL RESPONSIBILITY ─── */}
      <section id="social-responsibility" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
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
    </>
  );
}