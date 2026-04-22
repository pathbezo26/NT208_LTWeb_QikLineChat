const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// Tất cả route message đều cần đăng nhập

// GET /api/messages/:conversationId — Lấy lịch sử tin nhắn
router.get('/:conversationId', protect, getMessages);

// POST /api/messages — Lưu tin nhắn mới vào DB
router.post('/', protect, sendMessage);

module.exports = router;