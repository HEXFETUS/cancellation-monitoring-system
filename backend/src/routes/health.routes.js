import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "API is healthy 🚀"
    });
});

export default router;