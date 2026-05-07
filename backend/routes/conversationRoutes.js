const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createConversation, getConversations } = require('../controllers/conversationController');

// TODO: Sẽ hoàn thiện ở bước tiếp theo
// GET /api/conversations
// POST /api/conversations

router.get('/', protect, getConversations);
router.post('/', protect, createConversation);

module.exports = router;