import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import healthRoutes from "./src/routes/health.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import initDatabase from "./src/config/init.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// routes
app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;

initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
