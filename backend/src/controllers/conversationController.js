const Conversation = require('../models/Conversation');
const User = require('../models/User');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const cloudinary = require('../config/cloudinary');

// Cac field user duoc phep tra ve khi populate trong conversation.
// Khong populate passwordHash; chi them avatar metadata de frontend hien anh dai dien.
const USER_PUBLIC_FIELDS = 'username email avatar';
const USER_COMPACT_FIELDS = 'username avatar';
const LAST_MESSAGE_SENDER_FIELDS = 'username avatar';

const addUnreadCountForUser = (conversation, userId) => {
    const item = conversation.toObject();
    item.unreadCount = conversation.unreadCounts?.get(userId.toString()) || 0;
    return item;
};

const hasCloudinaryConfig = () => {
    return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
};

const uploadGroupAvatarToCloudinary = (fileBuffer, conversationId) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'qikline/group-avatars',
                public_id: `group_${conversationId}_${Date.now()}`,
                resource_type: 'image',
                overwrite: true,
                transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'auto' },
                    { quality: 'auto', fetch_format: 'auto' },
                ],
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        uploadStream.end(fileBuffer);
    });
};

// Chuyển danh sách identifier (Username/Email/ID) thành danh sách ObjectIDs
const getValidUserIds = async (identifiers) => {
    const userIds = [];

    for (let item of identifiers) {
        // Nếu là ID chuẩn của MongoDB
        if (mongoose.Types.ObjectId.isValid(item)) {
            userIds.push(item.toString());
        } else {
            // Nếu là Username hoặc Email, tìm trong DB để lấy ID
            const foundUser = await User.findOne({
                $or: [{ username: item }, { email: item }]
            });

            if (foundUser) {
                userIds.push(foundUser._id.toString());
            } else {
                throw new Error(`User "${item}" does not exist.`);
            }
        }
    }
    return userIds;
};

// ─── GET /api/conversations ───────────────────────────────────────────────────
// Lấy danh sách tất cả cuộc trò chuyện của user hiện tại
// Sắp xếp theo updatedAt (mới nhất trước)
const getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        // Tìm tất cả conversation mà user là thành viên
        // populate members để frontend hiển thị info người dùng, bao gồm avatar
        const conversations = await Conversation.find({
            members: userId,
            deletedFor: { $ne: userId },
        })
            .populate('members', USER_PUBLIC_FIELDS)
            .populate('createdBy', USER_COMPACT_FIELDS)
            .populate('lastMessage.sender', LAST_MESSAGE_SENDER_FIELDS)
            .sort({ updatedAt: -1 });

        res.status(200).json(
            conversations.map((conversation) => addUnreadCountForUser(conversation, userId))
        );
    } catch (error) {
        console.error('getConversations error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── POST /api/conversations ──────────────────────────────────────────────────
// Tạo cuộc trò chuyện private hoặc group
// Body: { type: 'private' | 'group', name?: string, members: [userId, ...] }
const createConversation = async (req, res) => {
    try {
        const { type, name, members } = req.body;
        const userId = req.user._id;

        // Validate input
        if (!type || !['private', 'group'].includes(type)) {
            return res.status(400).json({ message: 'Type must be "private" or "group"' });
        }

        if (type === 'group' && !name) {
            return res.status(400).json({ message: 'Group chat must have a name' });
        }

        if (!members || members.length < 1) {
            return res.status(400).json({ message: 'Must have at least 1 member' });
        }

        // Hàm lấy Id chuẩn
        const targetIds = await getValidUserIds(members);
        // Gộp ID người tạo và ID người nhận, loại bỏ trùng lặp
        const finalMembers = Array.from(new Set([userId.toString(), ...targetIds]));

        // Check có private trùng hay chưa
        if (type === 'private') {
            // Kiểm tra private chat — chỉ 2 thành viên
            if (finalMembers.length !== 2) {
                return res.status(400).json({ message: 'Private chat must have exactly 2 members' });
            }

            const existing = await Conversation.findOne({
                type: 'private',
                members: { $all: finalMembers, $size: 2 },
            })
                .populate('members', USER_PUBLIC_FIELDS)
                .populate('createdBy', USER_COMPACT_FIELDS);

            if (existing) {
                existing.deletedFor = (existing.deletedFor || []).filter(
                    (id) => id.toString() !== userId.toString()
                );
                await existing.save();
                return res.status(200).json(existing);
            }
        }

        // Kiểm tra members tồn tại
        const validUsers = await User.find({ _id: { $in: finalMembers } });
        if (validUsers.length !== finalMembers.length) {
            return res.status(400).json({ message: 'Some users do not exist' });
        }

        // Tạo conversation mới
        const conversation = await Conversation.create({
            type,
            name: type === 'group' ? name : null,
            members: finalMembers,
            createdBy: userId,
        });

        // Populate data trước khi trả về, bao gồm avatar để UI dùng ngay
        await conversation.populate('members', USER_PUBLIC_FIELDS);
        await conversation.populate('createdBy', USER_COMPACT_FIELDS);

        res.status(201).json(conversation);
    } catch (error) {
        console.error('createConversation error:', error);
        const statusCode = error.status || 500;
        res.status(statusCode).json({ message: error.message || 'Server error!' });
    }
};

// Xóa conversation khỏi danh sách của user hiện tại
const deleteConversation = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const userId = req.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        const isMember = conversation.members.some(
            (memberId) => memberId.toString() === userId.toString()
        );
        if (!isMember) {
            return res.status(403).json({ message: 'You do not have permission to delete this conversation' });
        }

        const alreadyDeleted = (conversation.deletedFor || []).some(
            (deletedUserId) => deletedUserId.toString() === userId.toString()
        );
        if (!alreadyDeleted) {
            conversation.deletedFor.push(userId);
            await conversation.save();
        }

        res.status(200).json({
            message: 'Conversation removed from your list',
            conversationId,
        });
    } catch (error) {
        console.error('deleteConversation error:', error);
        res.status(500).json({ message: 'Server error while deleting conversation' });
    }
};

const markConversationRead = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const userId = req.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        const isMember = conversation.members.some(
            (memberId) => memberId.toString() === userId.toString()
        );
        if (!isMember) {
            return res.status(403).json({ message: 'You do not have permission to read this conversation' });
        }

        await Conversation.findByIdAndUpdate(conversationId, {
            [`unreadCounts.${userId.toString()}`]: 0,
        });

        res.status(200).json({
            conversationId,
            unreadCount: 0,
        });
    } catch (error) {
        console.error('markConversationRead error:', error);
        res.status(500).json({ message: 'Server error while marking conversation as read' });
    }
};

// Upload avatar rieng cho group conversation.
const uploadGroupAvatar = async (req, res) => {
    try {
        if (!hasCloudinaryConfig()) {
            return res.status(500).json({ message: 'Cloudinary is not configured on the server' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please select a group image' });
        }

        const conversation = await Conversation.findById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        if (conversation.type !== 'group') {
            return res.status(400).json({ message: 'Only group chats can have a group image' });
        }

        const isMember = conversation.members.some(
            (memberId) => memberId.toString() === req.user._id.toString()
        );
        if (!isMember) {
            return res.status(403).json({ message: 'You do not have permission to update this group' });
        }

        const oldAvatarPublicId = conversation.avatar?.publicId;
        const uploadedAvatar = await uploadGroupAvatarToCloudinary(req.file.buffer, conversation._id);

        conversation.avatar = {
            url: uploadedAvatar.secure_url,
            publicId: uploadedAvatar.public_id,
            updatedAt: new Date(),
        };
        await conversation.save();

        if (oldAvatarPublicId) {
            cloudinary.uploader.destroy(oldAvatarPublicId).catch((error) => {
                console.error('Delete old group avatar error:', error);
            });
        }

        await conversation.populate('members', USER_PUBLIC_FIELDS);
        await conversation.populate('createdBy', USER_COMPACT_FIELDS);

        res.status(200).json({
            message: 'Group image updated successfully',
            conversation,
        });
    } catch (error) {
        console.error('Upload group avatar error:', error);
        res.status(500).json({ message: 'Server error while updating group image' });
    }
};

// Thêm các thành viên vào group
const addMembers = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const { newMemberIds } = req.body; // newMemberIds là mảng [id1, id2...]
        const userId = req.user._id;

        if (!Array.isArray(newMemberIds) || newMemberIds.length === 0) {
            return res.status(400).json({ message: 'Missing list of members to add' });
        }

        // Kiểm tra hội thoại có tồn tại và có phải là group ko
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
        if (conversation.type !== 'group') {
            return res.status(400).json({ message: 'Members can only be added to a group' });
        }

        // Bỏ người bị trùng
        const currentMembers = conversation.members.map(m => m.toString());
        const toAdd = newMemberIds.filter(id => !currentMembers.includes(id));

        if (toAdd.length === 0) {
            return res.status(400).json({ message: 'These members are already in the group' });
        }

        // Cập nhật DB
        conversation.members.push(...toAdd);
        conversation.updatedAt = new Date();
        await conversation.save();

        // Populate members sau khi thêm thành viên, bao gồm avatar của từng người.
        await conversation.populate('members', USER_PUBLIC_FIELDS);
        await conversation.populate('createdBy', USER_COMPACT_FIELDS);

        res.status(200).json({ message: 'Members added successfully', conversation });
    } catch (error) {
        console.error('createConversation error:', error);
        const statusCode = error.status || 500;
        res.status(statusCode).json({ message: error.message || 'Server error!' });
    }
};

// Xóa thành viên khỏi group
const removeMember = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const { memberId } = req.body; // MemberId là người bị xóa
        const userId = req.user._id;

        if (!memberId) {
            return res.status(400).json({ message: 'Missing memberId' });
        }

        // Kiểm tra hội thoại có tồn tại và có phải là group ko
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
        if (conversation.type !== 'group') {
            return res.status(400).json({ message: 'Members can only be removed from a group' });
        }

        // Check admin
        if (conversation.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You do not have permission to remove members' });
        }

        // if (!memberId) return res.status(400).json({ message: 'Thiếu memberId' });

        // Check người bị xóa có trong nhóm ko
        const exists = conversation.members.some(
            id => id.toString() === memberId
        );
        if (!exists) {
            return res.status(400).json({ message: 'This user is not in the group' });
        }

        // Xóa khỏi nhóm
        conversation.members = conversation.members.filter(
            id => id.toString() !== memberId
        );

        // Cập nhật DB
        conversation.updatedAt = new Date();
        await conversation.save();

        await conversation.populate('members', USER_PUBLIC_FIELDS);
        await conversation.populate('createdBy', USER_COMPACT_FIELDS);

        res.status(200).json({ message: 'Member removed successfully', conversation });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getConversations,
    createConversation,
    deleteConversation,
    markConversationRead,
    uploadGroupAvatar,
    addMembers,
    removeMember,
};
