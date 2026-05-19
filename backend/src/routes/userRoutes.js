const express = require('express');
const multer = require('multer');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const {
  uploadAvatar,
  updateAvatarCrop,
  deleteAvatar,
  updateUsername,
  updateUserId,
  blockUser,
  unblockUser,
  reportUser,
  getContacts,
  sendContactRequest,
  acceptContactRequest,
  declineContactRequest,
  cancelContactRequest,
  removeContact,
  getRelationshipStatusMap,
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

const isWordStartMatch = (value, keyword) => {
  const normalizedValue = normalizeSearchText(value || '');
  const normalizedKeyword = normalizeSearchText(keyword);

  return (
    normalizedValue.startsWith(normalizedKeyword) ||
    normalizedValue.includes(` ${normalizedKeyword}`)
  );
};

const isUserSearchMatch = (user, keyword) => {
  const normalizedKeyword = normalizeSearchText(keyword);
  const normalizedUserId = normalizeSearchText(user.userId || '');

  return (
    isWordStartMatch(user.username, keyword) ||
    normalizedUserId === normalizedKeyword ||
    normalizedUserId.startsWith(normalizedKeyword)
  );
};

router.patch('/me/avatar', protect, uploadLimiter, handleAvatarUpload, uploadAvatar);
router.patch('/me/avatar/crop', protect, updateAvatarCrop);

// DELETE /api/users/me/avatar — xóa avatar của user hiện tại
router.delete('/me/avatar', protect, deleteAvatar);
// PATCH /api/users/me/username - doi username cua user hien tai
router.patch('/me/username', protect, updateUsername);
router.patch('/me/user-id', protect, updateUserId);
router.get('/contacts', protect, getContacts);
router.post('/:id/contact-request', protect, sendContactRequest);
router.post('/contact-requests/:requestId/accept', protect, acceptContactRequest);
router.post('/contact-requests/:requestId/decline', protect, declineContactRequest);
router.delete('/contact-requests/:requestId', protect, cancelContactRequest);
router.delete('/:id/contact', protect, removeContact);
router.post('/:id/block', protect, blockUser);
router.delete('/:id/block', protect, unblockUser);
router.post('/:id/report', protect, reportUser);

// GET /api/users/search?q=keyword — search users by username (exclude self)
router.get('/search', protect, searchLimiter, async (req, res) => {
  const { q } = req.query;
  const keyword = (q || '').trim().replace(/^@+/, '');

  if (!keyword) return res.json([]);

  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      // Tra them avatar de frontend hien anh trong ket qua tim kiem user.
      .select('_id username userId email avatar')
      .sort({ username: 1 })
      .lean();

    const matchedUsers = users
      .filter((user) => isUserSearchMatch(user, keyword))
      .slice(0, 20);

    const relationshipStatusMap = await getRelationshipStatusMap(req.user, matchedUsers);

    res.json(matchedUsers.map((user) => ({
      ...user,
      relationshipStatus: relationshipStatusMap.get(user._id.toString()) || 'none',
    })));
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
