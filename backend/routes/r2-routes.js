const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  uploadImageToR2,
  uploadImagesToR2,
  deleteImageFromR2,
  deleteImagesFromR2,
  uploadVideoToR2,
  uploadVideosToR2,
  deleteVideoFromR2,
  deleteVideosFromR2,
  createPresignedUploadUrl,
} = require("../utils/r2");

// ── CHANGED: was `authenticateToken` from a different import path ─────────────
const { authenticate } = require("../middleware/auth");

// Multer — store to disk temporarily
const upload = multer({ dest: "uploads/" });

// ── Images ────────────────────────────────────────────────────────────────────

router.post(
  "/images/upload",
  authenticate,                          // ── CHANGED
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const url = await uploadImageToR2(req.file);
      res.json({ url });
    } catch (err) {
      console.error("Image upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

router.post(
  "/images/upload-many",
  authenticate,                          // ── CHANGED
  upload.array("files", 10),
  async (req, res) => {
    try {
      if (!req.files?.length) return res.status(400).json({ error: "No files provided" });
      const urls = await uploadImagesToR2(req.files);
      res.json({ urls });
    } catch (err) {
      console.error("Multi-image upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

router.delete("/images", authenticate, async (req, res) => {   // ── CHANGED
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });
    await deleteImageFromR2(url);
    res.json({ success: true });
  } catch (err) {
    console.error("Image delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

router.delete("/images/many", authenticate, async (req, res) => {  // ── CHANGED
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls) || !urls.length)
      return res.status(400).json({ error: "urls array is required" });
    await deleteImagesFromR2(urls);
    res.json({ success: true });
  } catch (err) {
    console.error("Multi-image delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ── Videos ────────────────────────────────────────────────────────────────────

router.post(
  "/videos/upload",
  authenticate,                          // ── CHANGED
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const url = await uploadVideoToR2(req.file);
      res.json({ url });
    } catch (err) {
      console.error("Video upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

router.post(
  "/videos/upload-many",
  authenticate,                          // ── CHANGED
  upload.array("files", 5),
  async (req, res) => {
    try {
      if (!req.files?.length) return res.status(400).json({ error: "No files provided" });
      const urls = await uploadVideosToR2(req.files);
      res.json({ urls });
    } catch (err) {
      console.error("Multi-video upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

router.delete("/videos", authenticate, async (req, res) => {   // ── CHANGED
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });
    await deleteVideoFromR2(url);
    res.json({ success: true });
  } catch (err) {
    console.error("Video delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

router.delete("/videos/many", authenticate, async (req, res) => {  // ── CHANGED
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls) || !urls.length)
      return res.status(400).json({ error: "urls array is required" });
    await deleteVideosFromR2(urls);
    res.json({ success: true });
  } catch (err) {
    console.error("Multi-video delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ── Presigned URLs ────────────────────────────────────────────────────────────

router.post("/presign", authenticate, async (req, res) => {    // ── CHANGED
  try {
    const { prefix, filename, contentType } = req.body;
    if (!prefix || !filename)
      return res.status(400).json({ error: "prefix and filename are required" });
    const result = await createPresignedUploadUrl(prefix, filename, contentType);
    res.json(result);
  } catch (err) {
    console.error("Presign error:", err);
    res.status(500).json({ error: "Could not generate presigned URL" });
  }
});

module.exports = router;