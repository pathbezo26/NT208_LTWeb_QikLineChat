const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiters');

const {
    getConversations,
    getConversationById,
    createConversation,
    deleteConversation,
    markConversationRead,
    uploadGroupAvatar,
    updateGroupDetails,
    addMembers,
    removeMember,
    updateGroupAdmins,
    transferGroupOwner,
    leaveGroup,
} = require('../controllers/conversationController');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error('Group image only supports JPG, PNG, or WEBP'));
        }

        cb(null, true);
    },
});

const handleGroupAvatarUpload = (req, res, next) => {
    upload.single('avatar')(req, res, (err) => {
        if (!err) return next();

        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'Group image must not exceed 2MB' });
        }

        return res.status(400).json({ message: err.message || 'Invalid group image file' });
    });
};

router.get('/', protect, getConversations);
router.get('/:id', protect, getConversationById);

// POST /api/conversations — Tạo conversation mới (private hoặc group)
router.post('/', protect, createConversation);

// DELETE /api/conversations/:id - Xóa conversation theo id
router.delete('/:id', protect, deleteConversation);
router.patch('/:id/read', protect, markConversationRead);
router.patch('/:id/avatar', protect, uploadLimiter, handleGroupAvatarUpload, uploadGroupAvatar);
router.patch('/:id/details', protect, updateGroupDetails);
router.put('/:id/add', protect, addMembers);
router.put('/:id/admins', protect, updateGroupAdmins);
router.put('/:id/owner', protect, transferGroupOwner);
router.put('/:id/leave', protect, leaveGroup);

// PUT /api/conversations - Xóa thành viên (chỉ là cập nhật ds thành viên nên dùng PUT)
router.put('/:id/remove', protect, removeMember);

module.exports = router;
