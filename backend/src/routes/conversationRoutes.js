const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const { getConversations, createConversation, deleteConversation, addMembers, removeMember } = require('../controllers/conversationController');

// GET /api/conversations — Lấy danh sách tất cả conversation của user
router.get('/', protect, getConversations);

// POST /api/conversations — Tạo conversation mới (private hoặc group)
router.post('/', protect, createConversation);
module.exports = router;

// DELETE /api/conversations - Xóa conversation
router.delete('/:conversationId', authMiddleware, deleteConversation);

// PUT /api/conversations - thêm thành viên
router.put('/', protect, addMembers);

// PUT /api/conversations - Xóa thành viên (chỉ là cập nhật ds thành viên nên dùng PUT)
router.put('/', protect, removeMember);