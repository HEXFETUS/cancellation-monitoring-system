import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

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
    const [query, setQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = options.find((o) => o.value === value) ?? null;

    const q = query.trim().toLowerCase();
    const filtered = q
        ? options.filter((o) => o.label.toLowerCase().includes(q))
        : [];

    const showOptions = open && q.length > 0 && filtered.length > 0;
    const showEmpty = open && (options.length === 0 || (q.length > 0 && filtered.length === 0));
    const showDropdown = showOptions || showEmpty;

    // Close when clicking outside
    useEffect(() => {
        const handlePointerDown = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("pointerdown", handlePointerDown, true);
        return () =>
            document.removeEventListener("pointerdown", handlePointerDown, true);
    }, []);

    // Reset highlight when filtered list changes
    useEffect(() => {
        setHighlight(0);
    }, [filtered.length]);

    // Scroll the highlighted item into view
    useEffect(() => {
        if (!showOptions) return;
        const list = containerRef.current?.querySelector("[role='listbox']");
        const item = list?.querySelector(`[data-index="${highlight}"]`);
        item?.scrollIntoView({ block: "nearest" });
    }, [highlight, showOptions]);

    const selectOption = (v: number) => {
        onChange(v);
        setOpen(false);
        setQuery("");
    };

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setQuery("");
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleFocus = () => {
        setOpen(true);
        setQuery("");
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        if (!open) setOpen(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (showOptions) {
                setHighlight((h) => (h + 1) % filtered.length);
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (showOptions) {
                setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (showOptions && filtered[highlight]) {
                selectOption(filtered[highlight].value);
            }
        }
    };

    // Show the selected label or query in the input
    const displayValue = open ? query : (selected?.label ?? "");

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={displayValue}
                    placeholder={placeholder}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    aria-haspopup="listbox"
                    aria-expanded={showDropdown}
                    className="w-full rounded-lg border border-warm bg-card px-3 py-2 pr-8 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                />
                {selected && !open && (
                    <button
                        type="button"
                        onClick={clearSelection}
                        className="absolute right-7 top-1/2 -translate-y-1/2 text-ink-subtle transition hover:text-ink"
                        tabIndex={-1}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {showDropdown && (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-warm bg-card shadow-lg"
                >
                    {showEmpty ? (
                        <li className="px-3 py-2 text-sm text-ink-muted">
                            {emptyMessage}
                        </li>
                    ) : (
                        filtered.map((opt, idx) => (
                            <li
                                key={opt.value}
                                data-index={idx}
                                role="option"
                                aria-selected={opt.value === value}
                                onMouseEnter={() => setHighlight(idx)}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    selectOption(opt.value);
                                }}
                                className={`cursor-pointer px-3 py-2 text-sm transition ${
                                    idx === highlight
                                        ? "bg-teal/10 text-ink dark:bg-teal/30 dark:text-white"
                                        : "text-ink hover:bg-cream dark:text-gray-300 dark:hover:bg-gray-700"
                                } ${opt.value === value ? "font-semibold" : ""}`}
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
