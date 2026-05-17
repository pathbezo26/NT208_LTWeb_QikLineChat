const express = require('express');
const multer = require('multer');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const {
  uploadAvatar,
  deleteAvatar,
  updateUsername,
  blockUser,
  unblockUser,
  reportUser,
} = require('../controllers/userController');
const { searchLimiter, uploadLimiter } = require('../middleware/rateLimiters');

// Cau hinh multer de nhan file avatar trong RAM, sau do controller upload thang len Cloudinary.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // Gioi han 2MB de tranh upload anh qua lon.
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Avatar only supports JPG, PNG, or WEBP'));
    }

    cb(null, true);
  },
});

// Middleware boc loi multer de tra JSON ro rang thay vi loi HTML/mac dinh cua Express.
const handleAvatarUpload = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Avatar must not exceed 2MB' });
    }

    return res.status(400).json({ message: err.message || 'Invalid avatar file' });
  });
};

// PATCH /api/users/me/avatar — upload hoặc thay avatar của user hiện tại
const normalizeSearchText = (value) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
};

const isWordStartMatch = (username, keyword) => {
  const normalizedUsername = normalizeSearchText(username);
  const normalizedKeyword = normalizeSearchText(keyword);

  return (
    normalizedUsername.startsWith(normalizedKeyword) ||
    normalizedUsername.includes(` ${normalizedKeyword}`)
  );
};

router.patch('/me/avatar', protect, uploadLimiter, handleAvatarUpload, uploadAvatar);

// DELETE /api/users/me/avatar — xóa avatar của user hiện tại
router.delete('/me/avatar', protect, deleteAvatar);
// PATCH /api/users/me/username - doi username cua user hien tai
router.patch('/me/username', protect, updateUsername);
router.post('/:id/block', protect, blockUser);
router.delete('/:id/block', protect, unblockUser);
router.post('/:id/report', protect, reportUser);

// GET /api/users/search?q=keyword — search users by username (exclude self)
router.get('/search', protect, searchLimiter, async (req, res) => {
  const { q } = req.query;
  const keyword = q?.trim();

  if (!keyword) return res.json([]);

  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      // Tra them avatar de frontend hien anh trong ket qua tim kiem user.
      .select('_id username email avatar')
      .sort({ username: 1 })
      .lean();

    const matchedUsers = users
      .filter((user) => isWordStartMatch(user.username, keyword))
      .slice(0, 20);

    res.json(matchedUsers);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
