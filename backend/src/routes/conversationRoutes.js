const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const { 
    getConversations, 
    createConversation, 
    deleteConversation, 
    addMembers, 
    removeMember 
} = require('../controllers/conversationController');

// GET /api/conversations — Lấy danh sách tất cả conversation của user
router.get('/', protect, getConversations);

// POST /api/conversations — Tạo conversation mới (private hoặc group)
router.post('/', protect, createConversation);

// DELETE /api/conversations/:id - Xóa conversation theo id
router.delete('/:conversationId', protect, deleteConversation);

// PUT /api/conversations:id/add - thêm thành viên theo id (add để phân biệt vs removeMember)
router.put('/:id/add', protect, addMembers);

// PUT /api/conversations - Xóa thành viên (chỉ là cập nhật ds thành viên nên dùng PUT)
router.put('/:id/remove', protect, removeMember);

module.exports = router;