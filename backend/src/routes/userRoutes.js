const express = require('express');
const multer = require('multer');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { uploadAvatar, deleteAvatar } = require('../controllers/userController');

// Cau hinh multer de nhan file avatar trong RAM, sau do controller upload thang len Cloudinary.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // Gioi han 2MB de tranh upload anh qua lon.
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Avatar chỉ hỗ trợ JPG, PNG hoặc WEBP'));
    }

    cb(null, true);
  },
});

// Middleware boc loi multer de tra JSON ro rang thay vi loi HTML/mac dinh cua Express.
const handleAvatarUpload = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Avatar không được vượt quá 2MB' });
    }

    return res.status(400).json({ message: err.message || 'File avatar không hợp lệ' });
  });
};

// PATCH /api/users/me/avatar — upload hoặc thay avatar của user hiện tại
router.patch('/me/avatar', protect, handleAvatarUpload, uploadAvatar);

// DELETE /api/users/me/avatar — xóa avatar của user hiện tại
router.delete('/me/avatar', protect, deleteAvatar);

// GET /api/users/search?q=keyword — search users by username (exclude self)
router.get('/search', protect, async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.json([]);

  try {
    const users = await User.find({
      username: { $regex: q.trim(), $options: 'i' },
      _id: { $ne: req.user.id },
    })
      .select('_id username email')
      .limit(20);

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server.', error: err.message });
  }
});

module.exports = router;
