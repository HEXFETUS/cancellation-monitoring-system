import express from "express";
import upload from "../config/multer.js";

const router = express.Router();

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "NO_FILE" });
  }
  const url = `/uploads/${req.file.filename}`;
  res.status(201).json({ url, filename: req.file.filename });
});

router.use((err, req, res, _next) => {
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: "INVALID_JSON" });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "FILE_TOO_LARGE", maxBytes: 5 * 1024 * 1024 });
  }
  if (err?.message?.includes("Invalid file type")) {
    return res.status(400).json({ error: "INVALID_FILE_TYPE" });
  }
  console.error("Upload error:", err.message);
  res.status(500).json({ error: "UPLOAD_FAILED" });
});

export default router;