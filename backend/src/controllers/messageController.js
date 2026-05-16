const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const cloudinary = require('../config/cloudinary');
const supabase = require('../config/supabase');
const { updateConversationAfterMessage } = require('../utils/conversationMeta');

const SENDER_PUBLIC_FIELDS = 'username avatar';
const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_ATTACHMENTS_PER_MESSAGE = 5;

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

    const safeName = sanitizeFileName(file.originalname);
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
        name: file.originalname,
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

            if (!isImage) {
                return uploadMessageFileToSupabase(file, conversationId);
            }

            const uploaded = await uploadMessageAttachmentToCloudinary(
                file.buffer,
                conversationId,
                file.originalname
            );

            return {
                type: isImage ? 'image' : 'file',
                url: uploaded.secure_url,
                publicId: uploaded.public_id,
                name: file.originalname,
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

module.exports = { getMessages, sendMessage, uploadAttachments, MAX_ATTACHMENTS_PER_MESSAGE };
