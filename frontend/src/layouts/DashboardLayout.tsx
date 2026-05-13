export default function DashboardLayout() {
    return (
        <div className="flex h-screen">

            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 text-white p-5">
                <h1 className="text-xl font-bold mb-6">
                    Cancellation System
                </h1>

                <nav className="space-y-3">
                    <div className="p-2 rounded hover:bg-gray-800 cursor-pointer">
                        Dashboard
                    </div>
                    <div className="p-2 rounded hover:bg-gray-800 cursor-pointer">
                        Records
                    </div>
                    <div className="p-2 rounded hover:bg-gray-800 cursor-pointer">
                        Reports
                    </div>
                </nav>
            </aside>

            {/* Main content */}
            <main className="flex-1 p-6 bg-gray-100">
                <h2 className="text-2xl font-bold">
                    Dashboard Overview
                </h2>

                <div className="grid grid-cols-3 gap-4 mt-6">

                    <div className="bg-white p-4 rounded shadow">
                        <p>Total Cancellations</p>
                        <h3 className="text-2xl font-bold">128</h3>
                    </div>

                    <div className="bg-white p-4 rounded shadow">
                        <p>Pending</p>
                        <h3 className="text-2xl font-bold text-yellow-500">34</h3>
                    </div>

                    <div className="bg-white p-4 rounded shadow">
                        <p>Resolved</p>
                        <h3 className="text-2xl font-bold text-green-500">94</h3>
                    </div>

                </div>

            </main>

        </div>
    );
}