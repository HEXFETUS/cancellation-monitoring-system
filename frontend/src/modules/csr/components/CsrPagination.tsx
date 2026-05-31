import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const teal = "#92C7CF";

interface CsrPaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (page: number) => void;
}

export default function CsrPagination({
    currentPage,
    totalPages,
    totalItems,
    onPageChange,
}: CsrPaginationProps) {
    if (totalPages <= 1) return null;

    const getVisiblePages = (): (number | "...")[] => {
        const pages: (number | "...")[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
            return pages;
        }

        pages.push(1);

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        if (start > 2) pages.push("...");
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push("...");

        pages.push(totalPages);
        return pages;
    };

    const visiblePages = getVisiblePages();

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/20 px-5 py-3">
            <p className="text-xs text-gray-500">
                Showing {Math.min((currentPage - 1) * 20 + 1, totalItems)}–
                {Math.min(currentPage * 20, totalItems)} of {totalItems}
            </p>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                    title="First page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30"
                    style={{
                        background: "rgba(255,255,255,0.35)",
                        border: "1px solid rgba(146,199,207,0.20)",
                    }}
                >
                    <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30"
                    style={{
                        background: "rgba(255,255,255,0.35)",
                        border: "1px solid rgba(146,199,207,0.20)",
                    }}
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>

                {visiblePages.map((page, i) =>
                    page === "..." ? (
                        <span
                            key={`ellipsis-${i}`}
                            className="inline-flex h-8 w-8 items-center justify-center text-xs text-gray-400"
                        >
                            …
                        </span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => onPageChange(page)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all duration-200"
                            style={{
                                background:
                                    page === currentPage
                                        ? `linear-gradient(135deg, ${teal}, #AAD7D9)`
                                        : "rgba(255,255,255,0.35)",
                                border:
                                    page === currentPage
                                        ? `1px solid ${teal}`
                                        : "1px solid rgba(146,199,207,0.20)",
                                color: page === currentPage ? "#fff" : "#4B5563",
                                boxShadow:
                                    page === currentPage
                                        ? `0 2px 8px rgba(146,199,207,0.30)`
                                        : "none",
                            }}
                        >
                            {page}
                        </button>
                    )
                )}

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30"
                    style={{
                        background: "rgba(255,255,255,0.35)",
                        border: "1px solid rgba(146,199,207,0.20)",
                    }}
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    title="Last page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30"
                    style={{
                        background: "rgba(255,255,255,0.35)",
                        border: "1px solid rgba(146,199,207,0.20)",
                    }}
                >
                    <ChevronsRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}