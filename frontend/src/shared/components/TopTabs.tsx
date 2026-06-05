import type { ReactNode, CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * A single tab descriptor consumed by the {@link TopTabs} component.
 *
 * Use a small string `id` to identify the tab and an optional `icon`,
 * `badge` (numeric count or short text) and `title` (tooltip / aria-label).
 */
export interface TopTabItem {
    /** Stable identifier for the tab. */
    id: string;
    /** Visible label. */
    label: string;
    /** Optional leading icon. */
    icon?: LucideIcon;
    /**
     * Optional badge content. Pass a number for a count, a string for free
     * text. Falsy values (`0`, `""`, `null`, `undefined`) hide the badge.
     */
    badge?: number | string | null;
    /** Badge color preset. Defaults to an orange "notification" gradient. */
    badgeColor?: "orange" | "red" | "teal" | "blue" | "neutral";
    /** Tooltip / aria-label override. Falls back to `label`. */
    title?: string;
}

export interface TopTabsProps {
    /** Tabs to render in the order they should appear. */
    tabs: TopTabItem[];
    /** Currently active tab id. */
    activeId: string;
    /** Click handler receiving the selected tab id. */
    onChange: (id: string) => void;
    /**
     * Visual variant.
     * - `"primary"`: main top tabs — bottom-border underline, transparent bg.
     * - `"secondary"`: sub tabs — filled pill with light teal background.
     */
    variant?: "primary" | "secondary";
    /** Optional element rendered on the right side of the tab bar. */
    rightSlot?: ReactNode;
    /** Extra class names for the outer bar. */
    className?: string;
    /** Whether the page is currently in dark mode (controls text colors). */
    darkMode?: boolean;
    /** Optional accessible label for the tablist. */
    ariaLabel?: string;
}

const teal = "#92C7CF";

type BadgeColor = NonNullable<TopTabItem["badgeColor"]>;

/**
 * Renders a small numeric badge for a tab. Returns `null` when there's
 * nothing meaningful to display.
 */
function TabBadge({
    badge,
    color = "orange",
    variant,
}: {
    badge: number | string | null | undefined;
    color: BadgeColor;
    variant: "primary" | "secondary";
}) {
    if (badge === null || badge === undefined) return null;
    if (typeof badge === "number" && badge <= 0) return null;
    if (typeof badge === "string" && badge.trim() === "") return null;

    const display =
        typeof badge === "number" && badge > 99 ? "99+" : String(badge);

    // Sub-tabs use a neutral pill so the badge blends with the section.
    if (variant === "secondary" || color === "neutral") {
        return (
            <span
                className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold"
                style={{ background: "rgba(146,199,207,0.3)", color: "#1F2937" }}
            >
                {display}
            </span>
        );
    }

    const styleByColor: Record<Exclude<BadgeColor, "neutral">, CSSProperties> = {
        orange: {
            background: "linear-gradient(135deg, #F59E0B, #FB923C)",
            boxShadow: "0 2px 6px rgba(245,158,11,0.35)",
        },
        red: {
            background: "#EF4444",
            boxShadow: "0 2px 6px rgba(239,68,68,0.35)",
        },
        teal: {
            background: teal,
            color: "#1F2937",
            boxShadow: "0 2px 6px rgba(146,199,207,0.35)",
        },
        blue: {
            background: "linear-gradient(135deg, #2563EB, #3B82F6)",
            boxShadow: "0 2px 6px rgba(37,99,235,0.35)",
        },
    };

    return (
        <span
            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
            style={styleByColor[color]}
        >
            {display}
        </span>
    );
}

/**
 * Shared horizontal tab strip used across the app.
 *
 * Two variants are exposed:
 *  - **primary** — for the main top tabs that replace the old icon-only
 *    left sidebar. Uses a teal bottom-border underline to indicate the
 *    active tab.
 *  - **secondary** — for nested sub-tab rows (e.g. the three "Reports"
 *    sub-tabs inside POS Inventory). Filled pill with a light teal
 *    background to make the hierarchy visually obvious.
 */
export default function TopTabs({
    tabs,
    activeId,
    onChange,
    variant = "primary",
    rightSlot,
    className = "",
    darkMode = false,
    ariaLabel,
}: TopTabsProps) {
    if (variant === "primary") {
        return (
            <div
                className={`flex items-center justify-between gap-3 border-b ${className}`}
                style={{
                    borderColor: darkMode
                        ? "rgba(75,85,99,0.55)"
                        : "rgba(229,225,218,0.90)",
                }}
                role="tablist"
                aria-label={ariaLabel}
            >
                <div className="flex overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeId === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => onChange(tab.id)}
                                title={tab.title ?? tab.label}
                                className="flex shrink-0 items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
                                style={{
                                    borderBottomColor: isActive ? teal : "transparent",
                                    color: isActive
                                        ? darkMode
                                            ? "#FFFFFF"
                                            : "#374151"
                                        : "#9CA3AF",
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.color = darkMode
                                            ? "#E5E7EB"
                                            : "#4B5563";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.color = "#9CA3AF";
                                    }
                                }}
                            >
                                {Icon && <Icon size={16} />}
                                <span>{tab.label}</span>
                                <TabBadge
                                    badge={tab.badge}
                                    color={tab.badgeColor ?? "orange"}
                                    variant="primary"
                                />
                            </button>
                        );
                    })}
                </div>
                {rightSlot && (
                    <div className="flex shrink-0 items-center gap-2 pr-2 pb-1">
                        {rightSlot}
                    </div>
                )}
            </div>
        );
    }

    // Secondary variant — sub tabs (filled pill).
    return (
        <div
            className={`flex flex-wrap items-center justify-between gap-3 border-b ${className}`}
            style={{
                borderColor: darkMode
                    ? "rgba(75,85,99,0.45)"
                    : "rgba(146,199,207,0.25)",
            }}
            role="tablist"
            aria-label={ariaLabel}
        >
            <div className="flex flex-wrap gap-1 overflow-x-auto">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeId === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => onChange(tab.id)}
                            title={tab.title ?? tab.label}
                            className="flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-t-xl cursor-pointer whitespace-nowrap"
                            style={{
                                background: isActive
                                    ? "rgba(146,199,207,0.15)"
                                    : "transparent",
                                border: isActive
                                    ? "1px solid rgba(146,199,207,0.25)"
                                    : "1px solid transparent",
                                borderBottom: isActive
                                    ? "1px solid transparent"
                                    : "1px solid transparent",
                                color: isActive
                                    ? darkMode
                                        ? "#FFFFFF"
                                        : "#1F2937"
                                    : "#6B7280",
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background =
                                        "rgba(146,199,207,0.06)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = "transparent";
                                }
                            }}
                        >
                            {Icon && <Icon size={16} />}
                            <span>{tab.label}</span>
                            <TabBadge
                                badge={tab.badge}
                                color={tab.badgeColor ?? "neutral"}
                                variant="secondary"
                            />
                        </button>
                    );
                })}
            </div>
            {rightSlot && (
                <div className="flex shrink-0 items-center gap-2 pb-2 pr-1">
                    {rightSlot}
                </div>
            )}
        </div>
    );
}
