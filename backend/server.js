import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import healthRoutes from "./src/routes/health.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import posRoutes from "./src/routes/pos.routes.js";
import cancellationRoutes from "./src/routes/cancellation.routes.js";
import assetRoutes from "./src/routes/asset.routes.js";
import assetCodeRoutes from "./src/routes/asset-code.routes.js";
import payoutStationRoutes from "./src/routes/payout-station.routes.js";
import officeDepartmentRoutes from "./src/routes/office-department.routes.js";
import boothChangeRequestRoutes from "./src/routes/booth-change-request.routes.js";
import initDatabase from "./src/config/init.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// routes
app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/pos", posRoutes);
app.use("/api/cancellation", cancellationRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/asset-codes", assetCodeRoutes);
app.use("/api/payout-stations", payoutStationRoutes);
app.use("/api/office-departments", officeDepartmentRoutes);
app.use("/api/booth-change-requests", boothChangeRequestRoutes);

const PORT = Number(process.env.PORT || 5050);

if (PORT !== 5050) {
    throw new Error(`Invalid PORT ${PORT}. This backend must run on port 5050.`);
}

initDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    });
