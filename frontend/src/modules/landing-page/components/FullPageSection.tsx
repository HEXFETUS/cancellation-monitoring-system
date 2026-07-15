import { type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type FullPageSectionProps = {
  id: string;
  backgroundColor: string;
  children: ReactNode;
  contentClassName?: string;
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function FullPageSection({
  id,
  backgroundColor,
  children,
  contentClassName = "",
}: FullPageSectionProps) {
  return (
    <section
      id={id}
      className="relative w-full h-dvh min-h-dvh shrink-0 overflow-hidden"
      style={{ backgroundColor }}
    >
      <div className="h-full overflow-y-auto overscroll-contain">
        <div
          className={`min-h-full flex items-center justify-center py-20 sm:py-24 ${contentClassName}`}
        >
          <div className="w-full">{children}</div>
        </div>
      </div>
    </section>
  );
}
