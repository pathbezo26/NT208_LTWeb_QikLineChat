const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const { getConversations, createConversation, addMembers } = require('../controllers/conversationController');

// GET /api/conversations — Lấy danh sách tất cả conversation của user
router.get('/', protect, getConversations);

// POST /api/conversations — Tạo conversation mới (private hoặc group)
router.post('/', protect, createConversation);
module.exports = router;

// PUT - thêm thành viên
router.put('/add-members', protect, addMembers);