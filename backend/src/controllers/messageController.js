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

const buildMessageReference = (sourceMessage) => {
    if (!sourceMessage) return undefined;

    return {
        messageId: sourceMessage._id,
        sender: sourceMessage.sender,
        content: sourceMessage.content,
        createdAt: sourceMessage.createdAt,
    };
};

const populateMessage = (message) => {
    return message.populate([
        { path: 'sender', select: SENDER_PUBLIC_FIELDS },
        { path: 'replyTo.sender', select: SENDER_PUBLIC_FIELDS },
        { path: 'forwardedFrom.sender', select: SENDER_PUBLIC_FIELDS },
    ]);
};

const getVisibleMessagesQuery = (conversation, userId, before) => {
    const query = { conversationId: conversation._id, deletedBy: { $ne: userId } };
    const createdAtFilter = {};
    const deletedAt = conversation.deletedAtBy?.get(userId.toString());

    if (deletedAt) {
        createdAtFilter.$gt = deletedAt;
    }

    if (before) {
        const beforeDate = new Date(before);

        if (Number.isNaN(beforeDate.getTime())) {
            const error = new Error('Invalid before cursor');
            error.status = 400;
            throw error;
        }

        createdAtFilter.$lt = beforeDate;
    }

    if (Object.keys(createdAtFilter).length > 0) {
        query.createdAt = createdAtFilter;
    }

    return query;
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
        const query = getVisibleMessagesQuery(conversation, userId, req.query.before);

        const messagesDesc = await Message.find(query)
            .populate('sender', SENDER_PUBLIC_FIELDS)
            .populate('replyTo.sender', SENDER_PUBLIC_FIELDS)
            .populate('forwardedFrom.sender', SENDER_PUBLIC_FIELDS)
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
        if (error.status === 400) {
            return res.status(400).json({ message: error.message });
        }

        console.error('getMessages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const sendMessage = async (req, res) => {
    try {
        const { conversationId, content, replyToMessageId, forwardedFromMessageId } = req.body;
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

        const [replyToMessage, forwardedFromMessage] = await Promise.all([
            replyToMessageId
                ? Message.findOne({ _id: replyToMessageId, conversationId })
                : null,
            forwardedFromMessageId
                ? Message.findById(forwardedFromMessageId)
                : null,
        ]);

        if (replyToMessageId && !replyToMessage) {
            return res.status(404).json({ message: 'Reply source message not found' });
        }

        if (forwardedFromMessageId && !forwardedFromMessage) {
            return res.status(404).json({ message: 'Forward source message not found' });
        }

        if (forwardedFromMessage) {
            const sourceConversation = await Conversation.findById(forwardedFromMessage.conversationId);
            if (!sourceConversation || !isConversationMember(sourceConversation, userId)) {
                return res.status(403).json({ message: 'You do not have permission to forward this message' });
            }
        }

        const messageData = {
            conversationId,
            sender: userId,
            content: trimmedContent,
            deliveredTo: [userId],
            readBy: [userId],
        };

        if (replyToMessage) {
            messageData.replyTo = buildMessageReference(replyToMessage);
        }

        if (forwardedFromMessage) {
            messageData.forwardedFrom = buildMessageReference(forwardedFromMessage);
        }

        const message = await Message.create(messageData);

        await updateConversationAfterMessage(conversation, message, userId);

        const populated = await populateMessage(message);

        res.status(201).json(populated);
    } catch (error) {
        console.error('sendMessage error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getMessages, sendMessage };
