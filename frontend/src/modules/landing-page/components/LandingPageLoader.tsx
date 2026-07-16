import LogoWithName from "../../../assets/LogoWithName.webp";

export default function LandingPageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Hexaprime home page"
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #FBF9F1 0%, #E5E1DA 100%)",
      }}
    >
      <div className="flex flex-col items-center gap-6">
        <img src={LogoWithName} alt="Hexaprime" className="h-12 w-auto sm:h-14" />
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-[3px] motion-reduce:animate-none"
          style={{
            borderColor: "rgba(146, 199, 207, 0.28)",
            borderTopColor: "#92C7CF",
          }}
        />
        <span className="sr-only">Loading Hexaprime home page</span>
      </div>
    </div>
  );
}
