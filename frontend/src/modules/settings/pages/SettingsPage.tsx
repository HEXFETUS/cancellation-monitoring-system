import { Link, Navigate, Outlet, useLocation } from "react-router-dom";

const settingsMenu = [
    { name: "User Accounts", path: "/app/settings/user-accounts" },
];

export default function SettingsPage() {
    const location = useLocation();

    if (location.pathname === "/app/settings") {
        return <Navigate to="/app/settings/user-accounts" replace />;
    }

    return (
        <div className="flex h-full gap-6">
            <nav className="w-56 shrink-0">
                <h2 className="mb-4 text-lg font-semibold text-gray-800">Settings</h2>
                <ul className="space-y-1">
                    {settingsMenu.map((item) => {
                        const isActive = location.pathname === item.path;

                        return (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${isActive
                                        ? "bg-blue-100 text-blue-700"
                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                                        }`}
                                >
                                    {item.name}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="min-w-0 flex-1">
                <Outlet />
            </div>
        </div>
    );
}
