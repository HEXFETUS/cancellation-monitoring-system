export default function DashboardPage() {
    return (
        <div className="space-y-6">

            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-500">Cancellation Monitoring System</p>

            <div className="grid grid-cols-3 gap-4 mt-6">

                <div className="p-4 bg-white shadow rounded">
                    Total Records: 128
                </div>

                <div className="p-4 bg-white shadow rounded">
                    Pending: 32
                </div>

                <div className="p-4 bg-white shadow rounded">
                    Resolved: 96
                </div>

            </div>

        </div>
    );
}