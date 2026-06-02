import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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
import diagnosisListRoutes from "./src/routes/diagnosis-list.routes.js";
import repairRecordRoutes from "./src/routes/repair-record.routes.js";
import diagnosisLogRoutes from "./src/routes/diagnosis-log.routes.js";
import releasedLogRoutes from "./src/routes/released-log.routes.js";
import postsRoutes from "./src/routes/posts.routes.js";
import bulletinRoutes from "./src/routes/bulletin.routes.js";
import activityLogRoutes from "./src/routes/activity-log.routes.js";
import initDatabase from "./src/config/init.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve uploaded files (images, videos). The multer storage in
// src/routes/posts.routes.js writes to <repo>/backend/src/public/uploads,
// so the static handler must point at that same directory — not at
// <repo>/backend/public/uploads (which doesn't exist).
app.use("/uploads", express.static(path.join(__dirname, "src", "public", "uploads")));

// Routes
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
app.use("/api/diagnosis-list", diagnosisListRoutes);
app.use("/api/repair-records", repairRecordRoutes);
app.use("/api/diagnosis-logs", diagnosisLogRoutes);
app.use("/api/released-logs", releasedLogRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/bulletin", bulletinRoutes);
app.use("/api/activity-logs", activityLogRoutes);

const PORT = Number(process.env.PORT || 5050);

if (PORT !== 5050) {
    throw new Error(`Invalid PORT ${PORT}. This backend must run on port 5050.`);
}

// Don't auto-bootstrap (init DB + listen) when the module is imported under a
// test runner — tests replace the DB pool with an in-memory one and drive the
// app through supertest. Vitest sets NODE_ENV to "test" automatically.
if (process.env.NODE_ENV !== "test") {
    initDatabase()
        .then(() => {
            app.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
            });
        });
}

export default app;