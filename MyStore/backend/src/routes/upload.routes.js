const router = require('express').Router();
const fs = require('fs');
const upload = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { looksLikeImage } = require('../utils/imageSignature');

// POST /api/uploads  (multipart form, field name "image")  -> { url: "/uploads/xxxx.jpg" }
router.post('/', authenticate, authorize('admin'), (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2 MB or smaller' : err.message });
    if (!req.file) return res.status(400).json({ message: 'No image received' });

    // Make sure the file content really is the image type it claims to be
    const head = Buffer.alloc(12);
    const fd = fs.openSync(req.file.path, 'r');
    fs.readSync(fd, head, 0, 12, 0);
    fs.closeSync(fd);
    if (!looksLikeImage(head, req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'The file is not a valid image' });
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

module.exports = router;
