const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
console.log('AuthMiddleware Type:', typeof authMiddleware);

// 1. Multer Storage Engine setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/avatars/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `avatar-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) return cb(null, true);
        cb(new Error('Chỉ chấp nhận file ảnh (.jpg, .jpeg, .png)'));
    }
});

// GET /api/users/search — SEARCH LOGIC RESTORED
router.get('/search', protect, async (req, res) => {
    const { q } = req.query;
    if (!q || !q.trim()) return res.json([]);

    try {
        const users = await User.find({
            username: { $regex: q.trim(), $options: 'i' },
            _id: { $ne: req.user.id },
        })
        .select('_id username email avatarUrl') // Added avatarUrl to search results too
        .limit(20);

        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server.', error: err.message });
    }
});

// PUT /api/users/avatar - Handle upload
router.put('/avatar', protect, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn một file ảnh.' });
        }

        const avatarPath = `/uploads/avatars/${req.file.filename}`;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { avatarUrl: avatarPath },
            { new: true }
        ).select('-passwordHash');

        res.json({
            message: 'Cập nhật avatar thành công!',
            user
        });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi upload.', error: err.message });
    }
});

module.exports = router;