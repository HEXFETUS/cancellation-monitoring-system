import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface Option {
    value: number;
    label: string;
}

interface DropdownProps {
    value: number | null;
    options: Option[];
    onChange: (value: number | null) => void;
    placeholder?: string;
    className?: string;
    emptyMessage?: string;
}

export default function Dropdown({
    value,
    options,
    onChange,
    placeholder = "Select an option",
    className = "",
    emptyMessage = "No options available",
}: DropdownProps) {
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const selected = options.find((o) => o.value === value) ?? null;

    // Close when clicking outside the component.
    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        // Capture phase so this runs before any option click handler.
        document.addEventListener("pointerdown", handlePointerDown, true);
        return () =>
            document.removeEventListener("pointerdown", handlePointerDown, true);
    }, [open]);

    // Reset highlight to the current value (or first option) whenever opened.
    useEffect(() => {
        if (open) {
            const idx = options.findIndex((o) => o.value === value);
            setHighlight(idx >= 0 ? idx : 0);
        }
    }, [open, options, value]);

    const selectOption = (v: number) => {
        onChange(v);
        setOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!open) {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        if (e.key === "Escape") {
            setOpen(false);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % Math.max(options.length, 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + options.length) % Math.max(options.length, 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const opt = options[highlight];
            if (opt) selectOption(opt.value);
        }
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                onKeyDown={handleKeyDown}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex w-full items-center justify-between rounded-lg border border-warm bg-card px-3 py-2 text-left text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
            >
                <span className={selected ? "text-ink" : "text-ink-subtle"}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown
                    size={16}
                    className={`text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-warm bg-card shadow-lg"
                >
                    {options.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-ink-subtle">
                            {emptyMessage}
                        </li>
                    ) : (
                        options.map((opt, idx) => (
                            <li
                                key={opt.value}
                                role="option"
                                aria-selected={opt.value === value}
                                onMouseEnter={() => setHighlight(idx)}
                                onMouseDown={(e) => {
                                    // Fire selection on mousedown so it happens
                                    // before any blur/focus side effects from
                                    // the document-level pointerdown listener.
                                    e.preventDefault();
                                    selectOption(opt.value);
                                }}
                                className={`cursor-pointer px-3 py-2 text-sm transition ${
                                    idx === highlight
                                        ? "bg-teal/10 text-ink"
                                        : "text-ink hover:bg-cream"
                                }`}
                            >
                                {opt.label}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}
