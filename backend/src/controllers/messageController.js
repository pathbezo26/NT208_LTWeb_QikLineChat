const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { updateConversationAfterMessage } = require('../utils/conversationMeta');

const SENDER_PUBLIC_FIELDS = 'username avatar';
const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LENGTH = 5000;

const normalizeLimit = (value) => {
    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_MESSAGE_LIMIT;

    return Math.min(parsed, MAX_MESSAGE_LIMIT);
};

const isConversationMember = (conversation, userId) => {
    return conversation.members
        .map((id) => id.toString())
        .includes(userId.toString());
};

const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        if (!isConversationMember(conversation, userId)) {
            return res.status(403).json({ message: 'You do not have permission to view this conversation' });
        }

        const limit = normalizeLimit(req.query.limit);
        const query = { conversationId, deletedBy: { $ne: userId } };

        if (req.query.before) {
            const beforeDate = new Date(req.query.before);

            if (Number.isNaN(beforeDate.getTime())) {
                return res.status(400).json({ message: 'Invalid before cursor' });
            }

            query.createdAt = { $lt: beforeDate };
        }

        const messagesDesc = await Message.find(query)
            .populate('sender', SENDER_PUBLIC_FIELDS)
            .sort({ createdAt: -1 })
            .limit(limit + 1);

        const hasMore = messagesDesc.length > limit;
        const page = hasMore ? messagesDesc.slice(0, limit) : messagesDesc;
        const messages = page.reverse();
        const nextCursor = messages.length > 0 ? messages[0].createdAt : null;

        res.status(200).json({
            messages,
            hasMore,
            nextCursor,
        });
    } catch (error) {
        console.error('getMessages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const sendMessage = async (req, res) => {
    try {
        const { conversationId, content } = req.body;
        const userId = req.user._id;
        const trimmedContent = content?.trim();

        if (!conversationId || !trimmedContent) {
            return res.status(400).json({ message: 'Missing conversationId or message content' });
        }

        if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        if (!isConversationMember(conversation, userId)) {
            return res.status(403).json({ message: 'You do not have permission to send messages here' });
        }

        const message = await Message.create({
            conversationId,
            sender: userId,
            content: trimmedContent,
        });

        await updateConversationAfterMessage(conversation, message, userId);

        const populated = await message.populate('sender', SENDER_PUBLIC_FIELDS);

        res.status(201).json(populated);
    } catch (error) {
        console.error('sendMessage error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getMessages, sendMessage };
