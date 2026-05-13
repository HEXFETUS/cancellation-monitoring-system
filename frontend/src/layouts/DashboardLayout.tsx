import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
    children: ReactNode;
}

export default function DashboardLayout({ children }: Props) {
    return (
        <div className="flex h-screen">

            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 text-white p-4 space-y-4">
                <h1 className="text-xl font-bold">
                    Cancellation System
                </h1>

                <nav className="space-y-2">
                    <Link to="/" className="block hover:text-gray-300">
                        Dashboard
                    </Link>

                    <Link to="/records" className="block hover:text-gray-300">
                        Records
                    </Link>

                    <Link to="/reports" className="block hover:text-gray-300">
                        Reports
                    </Link>

                    <Link to="/settings" className="block hover:text-gray-300">
                        Settings
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 bg-gray-100 p-6 overflow-auto">
                {children}
            </main>

        </div>
    );
}