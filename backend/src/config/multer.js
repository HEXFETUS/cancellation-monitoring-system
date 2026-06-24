import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "public", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `msg-${unique}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const allowedPattern = /jpeg|jpg|png|webp|gif/;
  const mimeOk = allowedPattern.test(file.mimetype);
  const extOk = allowedPattern.test(path.extname(file.originalname).toLowerCase());
  if (mimeOk && extOk) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only jpg, jpeg, png, webp, gif are allowed."));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

export default upload;