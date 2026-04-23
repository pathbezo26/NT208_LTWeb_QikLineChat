const Conversation = require('../models/Conversation');
const User = require('../models/User');

<<<<<<< HEAD:backend/controllers/conversationController.js
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
=======
// ─── GET /api/conversations ───────────────────────────────────────────────────
// Lấy danh sách tất cả cuộc trò chuyện của user hiện tại
// Sắp xếp theo updatedAt (mới nhất trước)
const getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        // Tìm tất cả conversation mà user là thành viên
        // populate members để frontend hiển thị info người dùng
        const conversations = await Conversation.find({ members: userId })
            .populate('members', 'username email')
            .populate('createdBy', 'username')
            .sort({ updatedAt: -1 });

        res.status(200).json({ conversations });
    } catch (error) {
        console.error('getConversations error:', error);
>>>>>>> 47c3c964ea039ce056e956fba4034d283a94b97b:backend/src/controllers/conversationController.js
        res.status(500).json({ message: 'Lỗi server' });
    }
};

<<<<<<< HEAD:backend/controllers/conversationController.js
module.exports = { createConversation, getConversations };
=======
// ─── POST /api/conversations ──────────────────────────────────────────────────
// Tạo cuộc trò chuyện private hoặc group
// Body: { type: 'private' | 'group', name?: string, members: [userId, ...] }
const createConversation = async (req, res) => {
    try {
        const { type, name, members } = req.body;
        const userId = req.user._id;

        // Validate input
        if (!type || !['private', 'group'].includes(type)) {
            return res.status(400).json({ message: 'Type phải là "private" hoặc "group"' });
        }

        if (type === 'group' && !name) {
            return res.status(400).json({ message: 'Group chat phải có tên' });
        }

        if (!members || members.length < 1) {
            return res.status(400).json({ message: 'Phải có ít nhất 1 thành viên' });
        }

        // Đảm bảo userId hiện tại nằm trong members
        const memberSet = new Set([userId.toString(), ...members.map(m => m.toString())]);
        const finalMembers = Array.from(memberSet);

        // Kiểm tra private chat — chỉ 2 thành viên
        if (type === 'private' && finalMembers.length !== 2) {
            return res.status(400).json({ message: 'Private chat phải chỉ có 2 thành viên' });
        }

        // Kiểm tra members tồn tại
        const validUsers = await User.find({ _id: { $in: finalMembers } });
        if (validUsers.length !== finalMembers.length) {
            return res.status(400).json({ message: 'Một số user không tồn tại' });
        }

        // Tạo conversation mới
        const conversation = await Conversation.create({
            type,
            name: type === 'group' ? name : null,
            members: finalMembers,
            createdBy: userId,
        });

        // Populate data trước khi trả về
        await conversation.populate('members', 'username email');
        await conversation.populate('createdBy', 'username');

        res.status(201).json({
            message: 'Tạo cuộc trò chuyện thành công',
            conversation,
        });
    } catch (error) {
        console.error('createConversation error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

module.exports = { getConversations, createConversation };
>>>>>>> 47c3c964ea039ce056e956fba4034d283a94b97b:backend/src/controllers/conversationController.js
