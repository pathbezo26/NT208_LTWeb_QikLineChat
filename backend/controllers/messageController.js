const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// ─── POST /api/messages ────────────────────────────────────────────────────────
// Send a message to a conversation
const sendMessage = async (req, res) => {
    try {
        const { conversationId, content } = req.body;

        // 1. Validate input
        if (!conversationId || !content) {
            return res.status(400).json({ message: 'Thiếu conversationId hoặc nội dung tin nhắn' });
        }

        // 2. Check conversation exists
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Cuộc trò chuyện không tồn tại' });
        }

        // 3. Check user is actually a member of this conversation
        const isMember = conversation.members.includes(req.user._id.toString());
        if (!isMember) {
            return res.status(403).json({ message: 'Bạn không thuộc cuộc trò chuyện này' });
        }

        // 4. Create the message
        const message = await Message.create({
            conversationId,
            sender: req.user._id,
            content
        });

        // 5. Update conversation's updatedAt so it bubbles to top of sidebar
        await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });

        // 6. Populate sender info before returning
        await message.populate('sender', 'username email');

        res.status(201).json({ message });

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ─── GET /api/messages/:conversationId ────────────────────────────────────────
// Get all messages in a conversation
const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

        // 1. Check conversation exists
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Cuộc trò chuyện không tồn tại' });
        }

        // 2. Check user is a member
        const isMember = conversation.members.includes(req.user._id.toString());
        if (!isMember) {
            return res.status(403).json({ message: 'Bạn không thuộc cuộc trò chuyện này' });
        }

        // 3. Get all messages, oldest first
        const messages = await Message.find({ conversationId })
            .populate('sender', 'username email')
            .sort({ createdAt: 1 });

        res.status(200).json({ messages });

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

module.exports = { sendMessage, getMessages };