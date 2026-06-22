import { useState, useRef, useEffect, useCallback } from "react";

interface TruncatedDescriptionProps {
    text: string;
}

export default function TruncatedDescription({
    text,
}: TruncatedDescriptionProps) {
    const [popupOpen, setPopupOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const cellRef = useRef<HTMLSpanElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const tooltipTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const textRef = useRef<HTMLSpanElement>(null);
    const [isTruncated, setIsTruncated] = useState(false);

    // Check if text is actually truncated (wider than container)
    useEffect(() => {
        const el = textRef.current;
        if (el) {
            // Check if the scroll width exceeds the client width (horizontal overflow)
            setIsTruncated(el.scrollWidth > el.clientWidth);
        }
    }, [text]);
    // Always show tooltip — user wants to read the full description on hover
    const showFullOnHover = text.length > 0;

    // Close popup when clicking outside or pressing Escape
    useEffect(() => {
        if (!popupOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                popupRef.current &&
                !popupRef.current.contains(e.target as Node) &&
                cellRef.current &&
                !cellRef.current.contains(e.target as Node)
            ) {
                setPopupOpen(false);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setPopupOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [popupOpen]);

    const handleClick = useCallback(() => {
        setPopupOpen((prev) => !prev);
    }, []);

    const handleMouseEnter = useCallback(() => {
        tooltipTimer.current = setTimeout(() => {
            setShowTooltip(true);
        }, 400); // small delay to avoid flicker
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (tooltipTimer.current) {
            clearTimeout(tooltipTimer.current);
            tooltipTimer.current = undefined;
        }
        setShowTooltip(false);
    }, []);

    // Close tooltip if popup opens
    useEffect(() => {
        if (popupOpen) setShowTooltip(false);
    }, [popupOpen]);

    const needsTruncation = isTruncated;

    return (
        <span
            ref={cellRef}
            className="relative inline-block max-w-full align-middle"
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* CSS line-clamp: max 2 lines with ellipsis */}
            <span
                ref={textRef}
                className="block"
                style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    wordBreak: "break-word",
                    lineHeight: "1.4",
                    maxHeight: "2.8em",
                }}
                title={needsTruncation ? text : undefined}
            >
                {text}
            </span>

            {/* Tooltip on hover — always shows the full text */}
            {showFullOnHover && showTooltip && !popupOpen && (
                <div
                    className="absolute bottom-full left-0 z-50 mb-2 max-w-xs rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink shadow-lg"
                    style={{ whiteSpace: "normal", wordBreak: "break-word" }}
                >
                    {text}
                    <div className="absolute left-3 top-full h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-warm bg-card" />
                </div>
            )}

            {/* Pop-up overlay on click */}
            {needsTruncation && popupOpen && (
                <div
                    ref={popupRef}
                    className="fixed z-50 rounded-lg border border-warm bg-card px-4 py-3 text-sm text-ink shadow-xl"
                    style={{
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                        maxWidth: "min(90vw, 32rem)",
                        // Position near the clicked cell
                        top: cellRef.current
                            ? Math.min(
                                  cellRef.current.getBoundingClientRect().bottom + 8,
                                  window.innerHeight - 200
                              )
                            : 0,
                        left: cellRef.current
                            ? Math.min(
                                  cellRef.current.getBoundingClientRect().left,
                                  window.innerWidth - 360
                              )
                            : 0,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <p className="mb-1 font-semibold text-ink-muted text-xs uppercase tracking-wider">
                        Full Description
                    </p>
                    <p>{text}</p>
                </div>
            )}
        </span>
    );
}