import { ClipboardList } from "lucide-react";

export default function RequestsTabbedPage() {
    return (
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            {/* Main content area */}
            <div className="flex-1 min-w-0">
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
                    <ClipboardList className="h-16 w-16 mb-4 opacity-40" />
                    <h2 className="text-xl font-semibold mb-2">Requests</h2>
                    <p className="text-sm">Requests module coming soon.</p>
                </div>
            </div>
        </div>
    );
}