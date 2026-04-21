const Conversation = require('../models/Conversation');
const User = require('../models/User');

// ─── POST /api/conversations ───────────────────────────────────────────────────
// Create a new conversation or return existing one
const createConversation = async (req, res) => {
    try {
        const { targetUserId, type } = req.body;

        // 1. Validate input
        if (!targetUserId) {
            return res.status(400).json({ message: 'Vui lòng chọn người dùng để trò chuyện' });
        }

        // 2. Check target user actually exists
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Người dùng không tồn tại' });
        }

        // 3. For private chat, check if conversation already exists
        if (type === 'private') {
            const existing = await Conversation.findOne({
                type: 'private',
                members: { $all: [req.user._id, targetUserId] }
            });

            // If already exists, just return it instead of creating duplicate
            if (existing) {
                return res.status(200).json({ conversation: existing });
            }
        }

        // 4. Create new conversation
        const conversation = await Conversation.create({
            type: type || 'private',
            members: [req.user._id, targetUserId],
            createdBy: req.user._id
        });

        res.status(201).json({ conversation });

    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ─── GET /api/conversations ────────────────────────────────────────────────────
// Get all conversations for the logged in user
const getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            members: { $in: [req.user._id] }
        })
        .populate('members', 'username email')
        .sort({ updatedAt: -1 });

        res.status(200).json({ conversations });

    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

module.exports = { createConversation, getConversations };