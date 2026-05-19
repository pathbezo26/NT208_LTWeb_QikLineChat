const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const supabase = require('../config/supabase');
const { updateConversationAfterMessage } = require('../utils/conversationMeta');

const SENDER_PUBLIC_FIELDS = 'username userId avatar';
const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_ATTACHMENTS_PER_MESSAGE = 5;
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 30;
const SEARCH_SCAN_BATCH_SIZE = 200;
const MAX_SHARED_RESOURCE_MESSAGES = 1000;
const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const LINK_PATTERN = /https?:\/\/[^\s]+/g;
const LINK_QUERY_PATTERN = /https?:\/\/[^\s]+/;

const normalizeSearchText = (value = '') => {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u0111\u0110]/g, 'd')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
};

const messageMatchesSearch = (message, keyword) => {
    const normalizedKeyword = normalizeSearchText(keyword);
    const normalizedContent = normalizeSearchText(message.content || '');

    if (!normalizedKeyword || !normalizedContent) return false;
    return normalizedContent.includes(normalizedKeyword);
};

const buildSearchSnippet = (content = '', keyword = '') => {
    const normalizedKeyword = normalizeSearchText(keyword);
    const normalizedContent = normalizeSearchText(content);
    let normalizedIndex = normalizedContent.indexOf(normalizedKeyword);

    const start = Math.max(normalizedIndex - 48, 0);
    const end = Math.min(start + 160, content.length);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < content.length ? '...' : '';

    return `${prefix}${content.slice(start, end)}${suffix}`;
};

const normalizeLimit = (value) => {
    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_MESSAGE_LIMIT;

    return Math.min(parsed, MAX_MESSAGE_LIMIT);
};

const normalizeSearchLimit = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_SEARCH_LIMIT;

    return Math.min(parsed, MAX_SEARCH_LIMIT);
};

const isConversationMember = (conversation, userId) => {
    return conversation.members
        .map((id) => id.toString())
        .includes(userId.toString());
};

const isPrivateConversationBlocked = async (conversation, userId) => {
    if (conversation.type !== 'private') return false;

    const memberIds = conversation.members.map((id) => id.toString());
    const otherMemberId = memberIds.find((memberId) => memberId !== userId.toString());
    if (!otherMemberId) return false;

    const users = await User.find({ _id: { $in: [userId, otherMemberId] } })
        .select('blockedUsers')
        .lean();
    const currentUser = users.find((item) => item._id.toString() === userId.toString());
    const otherUser = users.find((item) => item._id.toString() === otherMemberId);

    const currentBlocksOther = currentUser?.blockedUsers?.some((id) => id.toString() === otherMemberId);
    const otherBlocksCurrent = otherUser?.blockedUsers?.some((id) => id.toString() === userId.toString());

    return Boolean(currentBlocksOther || otherBlocksCurrent);
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

const uploadMessageAttachmentToCloudinary = (fileBuffer, conversationId, fileName) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `qikline/messages/${conversationId}`,
                resource_type: 'auto',
                use_filename: true,
                unique_filename: true,
                filename_override: fileName,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        uploadStream.end(fileBuffer);
    });
};

const looksLikeMojibakeFileName = (fileName = '') => {
    return /(?:Ã.|Â.|Ä.|Å.|Æ.|Ð.|á[º»].)/.test(fileName);
};

const normalizeUploadedFileName = (fileName = 'attachment') => {
    if (!looksLikeMojibakeFileName(fileName)) return fileName;

    const decodedName = Buffer.from(fileName, 'latin1').toString('utf8');
    if (!decodedName || decodedName.includes('\uFFFD')) return fileName;

    return decodedName;
};

const sanitizeFileName = (fileName = 'attachment') => {
    return fileName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'attachment';
};

const uploadMessageFileToSupabase = async (file, conversationId) => {
    if (!process.env.SUPABASE_FILE_BUCKET) {
        throw new Error('Missing SUPABASE_FILE_BUCKET');
    }

    const originalName = normalizeUploadedFileName(file.originalname);
    const safeName = sanitizeFileName(originalName);
    const filePath = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;

    const { data, error } = await supabase.storage
        .from(process.env.SUPABASE_FILE_BUCKET)
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });

    if (error) {
        throw error;
    }

    const { data: publicUrlData } = supabase.storage
        .from(process.env.SUPABASE_FILE_BUCKET)
        .getPublicUrl(data.path);

    return {
        type: 'file',
        url: publicUrlData.publicUrl,
        publicId: data.path,
        name: originalName,
        size: file.size,
        mimeType: file.mimetype,
        width: null,
        height: null,
    };
};

const normalizeAttachments = (attachments = []) => {
    if (!Array.isArray(attachments)) return [];

    return attachments
        .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
        .filter((attachment) => attachment?.url && attachment?.name)
        .map((attachment) => ({
            type: attachment.type === 'image' ? 'image' : 'file',
            url: attachment.url,
            publicId: attachment.publicId || '',
            name: attachment.name,
            size: Number(attachment.size) || 0,
            mimeType: attachment.mimeType || '',
            width: Number(attachment.width) || null,
            height: Number(attachment.height) || null,
        }));
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

const getPinnedMessages = async (req, res) => {
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

        const query = {
            ...getVisibleMessagesQuery(conversation, userId),
            isPinned: true,
            deletedForEveryone: { $ne: true },
        };

        const messages = await Message.find(query)
            .populate('sender', SENDER_PUBLIC_FIELDS)
            .populate('replyTo.sender', SENDER_PUBLIC_FIELDS)
            .populate('forwardedFrom.sender', SENDER_PUBLIC_FIELDS)
            .sort({ pinnedAt: -1, createdAt: -1 })
            .limit(50);

        res.status(200).json({ messages });
    } catch (error) {
        console.error('getPinnedMessages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const extractLinksFromMessage = (message) => {
    const matches = (message.content || '').match(LINK_PATTERN) || [];

    return matches.map((url) => ({
        url,
        domain: (() => {
            try {
                return new URL(url).hostname.replace(/^www\./, '');
            } catch {
                return url;
            }
        })(),
        messageId: message._id,
        senderName: message.sender?.username || 'Unknown',
        createdAt: message.createdAt,
    }));
};

const getSharedResources = async (req, res) => {
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

        const query = {
            ...getVisibleMessagesQuery(conversation, userId),
            type: { $ne: 'system' },
            deletedForEveryone: { $ne: true },
            $or: [
                { 'attachments.0': { $exists: true } },
                { content: LINK_QUERY_PATTERN },
            ],
        };

        const messages = await Message.find(query)
            .populate('sender', SENDER_PUBLIC_FIELDS)
            .select('attachments content sender createdAt')
            .sort({ createdAt: -1 })
            .limit(MAX_SHARED_RESOURCE_MESSAGES);

        const photos = [];
        const files = [];
        const links = [];

        messages.forEach((message) => {
            const senderName = message.sender?.username || 'Unknown';
            const attachments = Array.isArray(message.attachments) ? message.attachments : [];

            attachments.forEach((attachment) => {
                const rawAttachment = typeof attachment.toObject === 'function'
                    ? attachment.toObject()
                    : attachment;
                const item = {
                    ...rawAttachment,
                    messageId: message._id,
                    senderName,
                    createdAt: message.createdAt,
                };

                if (attachment.type === 'image') {
                    photos.push(item);
                } else {
                    files.push(item);
                }
            });

            links.push(...extractLinksFromMessage(message));
        });

        res.status(200).json({
            photos,
            files,
            links,
            truncated: messages.length >= MAX_SHARED_RESOURCE_MESSAGES,
        });
    } catch (error) {
        console.error('getSharedResources error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const sendMessage = async (req, res) => {
    try {
        const { conversationId, content, replyToMessageId, forwardedFromMessageId } = req.body;
        const userId = req.user._id;
        const trimmedContent = content?.trim();
        const attachments = normalizeAttachments(req.body.attachments);

        if (!conversationId || (!trimmedContent && attachments.length === 0 && !forwardedFromMessageId)) {
            return res.status(400).json({ message: 'Missing conversationId, message content, or attachment' });
        }

        if ((trimmedContent || '').length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        if (!isConversationMember(conversation, userId)) {
            return res.status(403).json({ message: 'You do not have permission to send messages here' });
        }

        if (await isPrivateConversationBlocked(conversation, userId)) {
            return res.status(403).json({ message: 'This private chat is blocked' });
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
            content: trimmedContent || '',
            attachments,
            deliveredTo: [userId],
            readBy: [userId],
        };

        if (replyToMessage) {
            messageData.replyTo = buildMessageReference(replyToMessage);
        }

        if (forwardedFromMessage) {
            messageData.forwardedFrom = buildMessageReference(forwardedFromMessage);
            messageData.attachments = normalizeAttachments(forwardedFromMessage.attachments);
        }

        const message = await Message.create(messageData);

        await updateConversationAfterMessage(conversation, message, userId);

        const populated = await populateMessage(message);

        res.status(201).json(populated);
    } catch (error) {
        console.error('sendMessage error:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
};

const uploadAttachments = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        if (!isConversationMember(conversation, userId)) {
            return res.status(403).json({ message: 'You do not have permission to upload files here' });
        }

        const files = req.files || [];
        if (files.length === 0) {
            return res.status(400).json({ message: 'Please choose at least one file' });
        }

        const attachments = await Promise.all(files.map(async (file) => {
            const isImage = file.mimetype.startsWith('image/');
            const originalName = normalizeUploadedFileName(file.originalname);

            if (!isImage) {
                return uploadMessageFileToSupabase(file, conversationId);
            }

            const uploaded = await uploadMessageAttachmentToCloudinary(
                file.buffer,
                conversationId,
                originalName
            );

            return {
                type: isImage ? 'image' : 'file',
                url: uploaded.secure_url,
                publicId: uploaded.public_id,
                name: originalName,
                size: file.size,
                mimeType: file.mimetype,
                width: uploaded.width || null,
                height: uploaded.height || null,
            };
        }));

        res.status(201).json({ attachments });
    } catch (error) {
        console.error('uploadAttachments error:', error);
        res.status(500).json({ message: error.message || 'Could not upload attachment' });
    }
};

const searchMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;
        const keyword = req.query.q?.trim();
        const limit = normalizeSearchLimit(req.query.limit);

        if (!keyword) {
            return res.status(200).json({
                messages: [],
                hasMore: false,
                nextCursor: null,
            });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        if (!isConversationMember(conversation, userId)) {
            return res.status(403).json({ message: 'You do not have permission to search this conversation' });
        }

        let cursor = req.query.before || null;
        let hasMoreSourceMessages = true;
        let scannedBatches = 0;
        const messages = [];

        while (messages.length < limit && hasMoreSourceMessages) {
            const query = {
                ...getVisibleMessagesQuery(conversation, userId, cursor),
                type: { $ne: 'system' },
                deletedForEveryone: { $ne: true },
                content: { $ne: '' },
            };

            const candidateMessages = await Message.find(query)
                .populate('sender', SENDER_PUBLIC_FIELDS)
                .sort({ createdAt: -1 })
                .limit(SEARCH_SCAN_BATCH_SIZE);

            scannedBatches += 1;
            hasMoreSourceMessages = candidateMessages.length === SEARCH_SCAN_BATCH_SIZE;
            cursor = candidateMessages.at(-1)?.createdAt || null;

            candidateMessages.forEach((message) => {
                if (messages.length >= limit) return;
                if (!messageMatchesSearch(message, keyword)) return;

                messages.push({
                    ...message.toObject(),
                    searchSnippet: buildSearchSnippet(message.content, keyword),
                });
            });
        }

        res.status(200).json({
            messages,
            hasMore: Boolean(hasMoreSourceMessages && cursor),
            nextCursor: hasMoreSourceMessages ? cursor : null,
        });
    } catch (error) {
        if (error.status === 400) {
            return res.status(400).json({ message: error.message });
        }

        console.error('searchMessages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;
        const scope = req.body.scope === 'everyone' ? 'everyone' : 'me';

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const conversation = await Conversation.findById(message.conversationId).select('members type');
        if (!conversation || !isConversationMember(conversation, userId)) {
            return res.status(403).json({ message: 'You do not have permission to delete this message' });
        }

        if (message.type === 'system') {
            return res.status(400).json({ message: 'System messages cannot be deleted' });
        }

        if (scope === 'everyone') {
            if (message.sender.toString() !== userId.toString()) {
                return res.status(403).json({ message: 'Only the sender can delete this message for everyone' });
            }

            message.content = '';
            message.attachments = [];
            message.deletedForEveryone = true;
            message.deletedAt = new Date();
            message.replyTo = undefined;
            message.forwardedFrom = undefined;
        } else {
            const isAlreadyDeleted = message.deletedBy.some((deletedUserId) => {
                return deletedUserId.toString() === userId.toString();
            });

            if (!isAlreadyDeleted) {
                message.deletedBy.push(userId);
            }
        }

        await message.save({ validateBeforeSave: false });

        const payload = {
            messageId: message._id,
            conversationId: message.conversationId,
            scope,
            userId,
            deletedForEveryone: message.deletedForEveryone,
            deletedAt: message.deletedAt,
        };

        const io = req.app.get('io');
        if (scope === 'everyone') {
            conversation.members.forEach((memberId) => {
                io?.to(`user:${memberId.toString()}`).emit('messageDeleted', payload);
            });
        } else {
            io?.to(`user:${userId.toString()}`).emit('messageDeleted', payload);
        }

        res.status(200).json(payload);
    } catch (error) {
        console.error('deleteMessage error:', error);
        res.status(500).json({ message: 'Server error while deleting message' });
    }
};

const togglePinMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const conversation = await Conversation.findById(message.conversationId).select('members');
        if (!conversation || !isConversationMember(conversation, userId)) {
            return res.status(403).json({ message: 'You do not have permission to pin this message' });
        }

        if (message.type === 'system' || message.deletedForEveryone) {
            return res.status(400).json({ message: 'This message cannot be pinned' });
        }

        const nextPinnedState = !message.isPinned;
        message.isPinned = nextPinnedState;
        message.pinnedBy = nextPinnedState ? userId : null;
        message.pinnedAt = nextPinnedState ? new Date() : null;

        await message.save({ validateBeforeSave: false });

        const populated = await populateMessage(message);
        const payload = {
            messageId: message._id,
            conversationId: message.conversationId,
            isPinned: message.isPinned,
            pinnedBy: message.pinnedBy,
            pinnedAt: message.pinnedAt,
            message: populated,
        };

        const io = req.app.get('io');
        conversation.members.forEach((memberId) => {
            io?.to(`user:${memberId.toString()}`).emit('messagePinUpdated', payload);
        });

        res.status(200).json(payload);
    } catch (error) {
        console.error('togglePinMessage error:', error);
        res.status(500).json({ message: 'Server error while updating pinned message' });
    }
};

const toggleReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;
        const emoji = req.body.emoji?.trim();

        if (!ALLOWED_REACTIONS.includes(emoji)) {
            return res.status(400).json({ message: 'Unsupported reaction' });
        }

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        if (message.type === 'system' || message.deletedForEveryone) {
            return res.status(400).json({ message: 'This message cannot be reacted to' });
        }

        const conversation = await Conversation.findById(message.conversationId).select('members');
        if (!conversation || !isConversationMember(conversation, userId)) {
            return res.status(403).json({ message: 'You do not have permission to react to this message' });
        }

        const userIdString = userId.toString();
        const currentReactions = Array.isArray(message.reactions) ? message.reactions : [];
        const existingReaction = currentReactions.find((reaction) => {
            return reaction.user?.toString() === userIdString && reaction.emoji === emoji;
        });

        if (existingReaction) {
            message.reactions = currentReactions.filter((reaction) => {
                return !(reaction.user?.toString() === userIdString && reaction.emoji === emoji);
            });
        } else {
            message.reactions = [
                ...currentReactions.filter((reaction) => reaction.user?.toString() !== userIdString),
                { emoji, user: userId, createdAt: new Date() },
            ];
        }

        await message.save({ validateBeforeSave: false });

        const payload = {
            messageId: message._id,
            conversationId: message.conversationId,
            reactions: message.reactions,
        };

        const io = req.app.get('io');
        conversation.members.forEach((memberId) => {
            io?.to(`user:${memberId.toString()}`).emit('messageReactionUpdated', payload);
        });

        res.status(200).json(payload);
    } catch (error) {
        console.error('toggleReaction error:', error);
        res.status(500).json({ message: 'Server error while updating reaction' });
    }
};

module.exports = {
    getMessages,
    getPinnedMessages,
    getSharedResources,
    searchMessages,
    sendMessage,
    deleteMessage,
    togglePinMessage,
    toggleReaction,
    uploadAttachments,
    MAX_ATTACHMENTS_PER_MESSAGE,
};
