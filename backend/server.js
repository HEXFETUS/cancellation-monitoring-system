import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import healthRoutes from "./src/routes/health.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// routes
app.use("/api/health", healthRoutes);

app.listen(5000, () => {
    console.log("Server running on port 5000");
});