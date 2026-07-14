import { TrendingUp, Shield } from "lucide-react";

/* ---------------- COLOR PALETTE ---------------- */
/* 
  #92C7CF  – primary teal
  #AAD7D9  – light teal  
  #FBF9F1  – cream bg
  #E5E1DA  – warm gray
*/

/* ---------------- COMPONENT ---------------- */
export default function AboutUs() {
  return (
    <>
      {/* ─── ABOUT US ─── */}
      <section id="about-us" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
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
    </>
  );
}