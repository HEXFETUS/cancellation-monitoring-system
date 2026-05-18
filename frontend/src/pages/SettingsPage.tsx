import { Link, Outlet, useLocation } from "react-router-dom";

const settingsMenu = [
    { name: "User Accounts", path: "/app/settings/user-accounts" },
];

export default function SettingsPage() {
    const location = useLocation();

    return (
        <div className="flex gap-6 h-full">
            {/* Settings Sub-navigation */}
            <nav className="w-56 shrink-0">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Settings</h2>
                <ul className="space-y-1">
                    {settingsMenu.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition ${
                                        isActive
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

            {/* Settings Content */}
            <div className="flex-1 min-w-0">
                <Outlet />
            </div>
        </div>
    );
}