import express from "express";
import path from "path";
import pool from "../config/db.js";
import { verifyAssetFileSignature, verifyPrivateUploadSignature } from "../middleware/auth.js";

const router = express.Router();
const uploadsDir = path.resolve("src", "public", "uploads");

// Asset media uses short-lived signed links because <img> and <video> cannot
// attach an Authorization header. The raw /uploads filename is never served.
router.get("/assets/:mediaId", async (req, res) => {
    const mediaId = Number(req.params.mediaId);
    const expiresAt = Number(req.query.expires);
    const signature = req.query.signature;
    if (!verifyAssetFileSignature(mediaId, expiresAt, signature)) {
        return res.status(403).json({ error: "file_access_denied" });
    }
    try {
        const result = await pool.query("SELECT url, mime_type FROM asset_media WHERE id = $1::int", [mediaId]);
        const url = result.rows[0]?.url;
        if (!url || !url.startsWith("/uploads/")) return res.sendStatus(404);
        const filename = path.basename(url);
        const absolutePath = path.resolve(uploadsDir, filename);
        if (!absolutePath.startsWith(`${uploadsDir}${path.sep}`)) return res.sendStatus(404);
        if (result.rows[0].mime_type) res.type(result.rows[0].mime_type);
        return res.sendFile(absolutePath, (err) => {
            if (err && !res.headersSent) res.sendStatus(err.code === "ENOENT" ? 404 : 500);
        });
    } catch (err) {
        console.error("asset file access error:", err.message);
        return res.sendStatus(500);
    }
});

router.get("/private/:filename", (req, res) => {
    const filename = path.basename(req.params.filename);
    if (!verifyPrivateUploadSignature(filename, Number(req.query.expires), req.query.signature)) {
        return res.status(403).json({ error: "file_access_denied" });
    }
    const absolutePath = path.resolve(uploadsDir, filename);
    if (!absolutePath.startsWith(`${uploadsDir}${path.sep}`)) return res.sendStatus(404);
    return res.sendFile(absolutePath, (err) => {
        if (err && !res.headersSent) res.sendStatus(err.code === "ENOENT" ? 404 : 500);
    });
});

export default router;
