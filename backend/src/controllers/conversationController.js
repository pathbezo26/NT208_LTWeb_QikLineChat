const Conversation = require('../models/Conversation');
const User = require('../models/User');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const cloudinary = require('../config/cloudinary');
const { updateConversationAfterMessage } = require('../utils/conversationMeta');

// Cac field user duoc phep tra ve khi populate trong conversation.
// Khong populate passwordHash; chi them avatar metadata de frontend hien anh dai dien.
const USER_PUBLIC_FIELDS = 'username email avatar lastSeenAt blockedUsers';
const USER_COMPACT_FIELDS = 'username avatar';
const LAST_MESSAGE_SENDER_FIELDS = 'username avatar';

const addUnreadCountForUser = (conversation, userId) => {
    const userIdString = userId.toString();
    const item = conversation.toObject();

    item.unreadCount = conversation.unreadCounts?.get(userIdString) || 0;
    item.deletedAt = conversation.deletedAtBy?.get(userIdString) || null;

    return item;
};

const populateConversationForSidebar = (query) => {
    return query
        .populate('members', USER_PUBLIC_FIELDS)
        .populate('createdBy', USER_COMPACT_FIELDS)
        .populate('admins', USER_COMPACT_FIELDS)
        .populate('lastMessage.sender', LAST_MESSAGE_SENDER_FIELDS);
};

const populateConversationDetails = async (conversation) => {
    await conversation.populate('members', USER_PUBLIC_FIELDS);
    await conversation.populate('createdBy', USER_COMPACT_FIELDS);
    await conversation.populate('admins', USER_COMPACT_FIELDS);
    await conversation.populate('lastMessage.sender', LAST_MESSAGE_SENDER_FIELDS);
    return conversation;
};

const getIdString = (value) => {
    if (!value) return '';
    return typeof value === 'object' ? (value._id || value.id || value).toString() : value.toString();
};

const isConversationMember = (conversation, userId) => {
    const userIdString = userId.toString();
    return conversation.members.some((memberId) => getIdString(memberId) === userIdString);
};

const isGroupOwner = (conversation, userId) => {
    return getIdString(conversation.createdBy) === userId.toString();
};

const isGroupAdmin = (conversation, userId) => {
    const userIdString = userId.toString();
    return (conversation.admins || []).some((adminId) => getIdString(adminId) === userIdString);
};

const canManageGroup = (conversation, userId) => {
    return isGroupOwner(conversation, userId) || isGroupAdmin(conversation, userId);
};

const isPrivateChatBlocked = async (firstUserId, secondUserId) => {
    const users = await User.find({ _id: { $in: [firstUserId, secondUserId] } })
        .select('blockedUsers')
        .lean();
    const firstUser = users.find((item) => item._id.toString() === firstUserId.toString());
    const secondUser = users.find((item) => item._id.toString() === secondUserId.toString());

    const firstBlocksSecond = firstUser?.blockedUsers?.some((id) => id.toString() === secondUserId.toString());
    const secondBlocksFirst = secondUser?.blockedUsers?.some((id) => id.toString() === firstUserId.toString());

    return Boolean(firstBlocksSecond || secondBlocksFirst);
};

const getUserLabel = (user) => {
    if (!user) return 'Someone';
    return user.username || user.email || 'Someone';
};

const emitToConversationMembers = (io, members, eventName, payload) => {
    if (!io) return;

    members.forEach((memberId) => {
        io.to(`user:${getIdString(memberId)}`).emit(eventName, payload);
    });
};

const populateSystemMessage = (message) => {
    return message.populate([
        { path: 'sender', select: USER_PUBLIC_FIELDS },
    ]);
};

const createSystemMessageAndEmit = async (req, conversation, actorId, content) => {
    const io = req.app.get('io');
    const message = await Message.create({
        conversationId: conversation._id,
        sender: actorId,
        type: 'system',
        content,
        deliveredTo: [actorId],
        readBy: [actorId],
    });
    const populatedMessage = await populateSystemMessage(message);
    const updatedConversation = await updateConversationAfterMessage(
        {
            _id: conversation._id,
            members: conversation.members.map(getIdString),
        },
        message,
        actorId
    );
    if (updatedConversation) {
        conversation.lastMessage = updatedConversation.lastMessage;
        conversation.updatedAt = updatedConversation.updatedAt;
        conversation.unreadCounts = updatedConversation.unreadCounts;
        conversation.deletedFor = updatedConversation.deletedFor;
    }
    await populateConversationDetails(conversation);

    emitToConversationMembers(io, conversation.members, 'newMessage', populatedMessage.toObject());
    conversation.members.forEach((memberId) => {
        const memberIdString = getIdString(memberId);
        const unreadCount = updatedConversation?.unreadCounts?.get(memberIdString) || 0;

        io?.to(`user:${memberIdString}`).emit('conversationUpdated', {
            conversationId: conversation._id,
            senderId: actorId,
            messageId: populatedMessage._id,
            unreadCount,
            updatedAt: updatedConversation?.updatedAt || message.createdAt,
            conversation: conversation.toObject(),
            lastMessage: {
                messageId: populatedMessage._id,
                sender: populatedMessage.sender,
                content: populatedMessage.content,
                createdAt: populatedMessage.createdAt,
            },
        });
    });

    return populatedMessage;
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
        const conversations = await populateConversationForSidebar(Conversation.find({
            members: userId,
            deletedFor: { $ne: userId },
        }))
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

            const otherMemberId = finalMembers.find((memberId) => memberId !== userId.toString());
            if (await isPrivateChatBlocked(userId, otherMemberId)) {
                return res.status(403).json({ message: 'This private chat is blocked' });
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
            admins: [],
            deletedFor: type === 'private'
                ? finalMembers.filter((memberId) => memberId !== userId.toString())
                : [],
            deletedAtBy: type === 'private'
                ? finalMembers
                    .filter((memberId) => memberId !== userId.toString())
                    .reduce((result, memberId) => {
                        result[memberId] = new Date();
                        return result;
                    }, {})
                : {},
        });

        // Populate data trước khi trả về, bao gồm avatar để UI dùng ngay
        await conversation.populate('members', USER_PUBLIC_FIELDS);
        await conversation.populate('createdBy', USER_COMPACT_FIELDS);
        await conversation.populate('admins', USER_COMPACT_FIELDS);

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
        }

        conversation.deletedAtBy.set(userId.toString(), new Date());
        conversation.unreadCounts.set(userId.toString(), 0);
        await conversation.save();

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

        await Message.updateMany(
            {
                conversationId,
                sender: { $ne: userId },
                deletedBy: { $ne: userId },
            },
            {
                $addToSet: {
                    deliveredTo: userId,
                    readBy: userId,
                },
            }
        );

        res.status(200).json({
            conversationId,
            unreadCount: 0,
        });
    } catch (error) {
        console.error('markConversationRead error:', error);
        res.status(500).json({ message: 'Server error while marking conversation as read' });
    }
};

const getConversationById = async (req, res) => {
    try {
        const userId = req.user._id;
        const conversationId = req.params.id;

        const conversation = await populateConversationForSidebar(Conversation.findOne({
            _id: conversationId,
            members: userId,
            deletedFor: { $ne: userId },
        }));

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        res.status(200).json(addUnreadCountForUser(conversation, userId));
    } catch (error) {
        console.error('getConversationById error:', error);
        res.status(500).json({ message: 'Server error' });
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

        if (!canManageGroup(conversation, req.user._id)) {
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

        await populateConversationDetails(conversation);
        await createSystemMessageAndEmit(
            req,
            conversation,
            req.user._id,
            `${getUserLabel(req.user)} updated the group photo`
        );

        res.status(200).json({
            message: 'Group image updated successfully',
            conversation,
        });
    } catch (error) {
        console.error('Upload group avatar error:', error);
        res.status(500).json({ message: 'Server error while updating group image' });
    }
};

const updateGroupDetails = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const userId = req.user._id;
        const { name } = req.body;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
        if (conversation.type !== 'group') {
            return res.status(400).json({ message: 'Only group chats can be updated' });
        }

        if (!canManageGroup(conversation, userId)) {
            return res.status(403).json({ message: 'Only group admins can update group details' });
        }

        const oldName = conversation.name;
        if (typeof name === 'string') {
            const nextName = name.trim();
            if (!nextName) {
                return res.status(400).json({ message: 'Group name is required' });
            }

            conversation.name = nextName;
        }

        conversation.updatedAt = new Date();
        await conversation.save();
        await populateConversationDetails(conversation);
        if (oldName !== conversation.name) {
            await createSystemMessageAndEmit(
                req,
                conversation,
                userId,
                `${getUserLabel(req.user)} renamed the group to "${conversation.name}"`
            );
        }

        res.status(200).json({ message: 'Group details updated successfully', conversation });
    } catch (error) {
        console.error('updateGroupDetails error:', error);
        res.status(500).json({ message: 'Server error while updating group details' });
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

        if (!canManageGroup(conversation, userId)) {
            return res.status(403).json({ message: 'Only group admins can add members' });
        }

        // Bỏ người bị trùng
        const currentMembers = conversation.members.map(m => m.toString());
        const toAdd = newMemberIds.filter(id => !currentMembers.includes(id));

        if (toAdd.length === 0) {
            return res.status(400).json({ message: 'These members are already in the group' });
        }

        // Cập nhật DB
        const addedUsers = await User.find({ _id: { $in: toAdd } }).select(USER_PUBLIC_FIELDS);
        if (addedUsers.length !== toAdd.length) {
            return res.status(400).json({ message: 'Some users do not exist' });
        }

        conversation.members.push(...toAdd);
        conversation.updatedAt = new Date();
        await conversation.save();

        // Populate members sau khi thêm thành viên, bao gồm avatar của từng người.
        await populateConversationDetails(conversation);
        await createSystemMessageAndEmit(
            req,
            conversation,
            userId,
            `${getUserLabel(req.user)} added ${addedUsers.map(getUserLabel).join(', ')}`
        );

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

        if (!canManageGroup(conversation, userId)) {
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

        const isTargetOwner = isGroupOwner(conversation, memberId);
        if (isTargetOwner) {
            return res.status(400).json({ message: 'The group owner cannot be removed' });
        }

        const isRequesterOwner = isGroupOwner(conversation, userId);
        const isTargetAdmin = isGroupAdmin(conversation, memberId);
        if (!isRequesterOwner && isTargetAdmin) {
            return res.status(403).json({ message: 'Only the group owner can remove admins' });
        }

        // Xóa khỏi nhóm
        const removedUser = await User.findById(memberId).select(USER_PUBLIC_FIELDS);

        conversation.members = conversation.members.filter(
            id => id.toString() !== memberId
        );
        conversation.admins = (conversation.admins || []).filter(
            id => id.toString() !== memberId
        );

        // Cập nhật DB
        conversation.updatedAt = new Date();
        await conversation.save();

        await populateConversationDetails(conversation);
        await createSystemMessageAndEmit(
            req,
            conversation,
            userId,
            `${getUserLabel(req.user)} removed ${getUserLabel(removedUser)}`
        );
        req.app.get('io')?.to(`user:${memberId}`).emit('conversationRemoved', { conversationId });

        res.status(200).json({ message: 'Member removed successfully', conversation });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const updateGroupAdmins = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const { adminIds, action } = req.body;
        const userId = req.user._id;

        if (!Array.isArray(adminIds) || adminIds.length === 0) {
            return res.status(400).json({ message: 'Missing list of admins' });
        }

        if (!['add', 'remove'].includes(action)) {
            return res.status(400).json({ message: 'Action must be "add" or "remove"' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
        if (conversation.type !== 'group') {
            return res.status(400).json({ message: 'Admins can only be managed in a group' });
        }

        if (!isGroupOwner(conversation, userId)) {
            return res.status(403).json({ message: 'Only the group owner can manage admins' });
        }

        const memberIds = new Set(conversation.members.map(getIdString));
        const ownerId = getIdString(conversation.createdBy);
        const normalizedAdminIds = Array.from(new Set(adminIds.map(String)));

        const invalidAdminId = normalizedAdminIds.find((adminId) => {
            return !memberIds.has(adminId) || adminId === ownerId;
        });
        if (invalidAdminId) {
            return res.status(400).json({ message: 'Admins must be group members and cannot be the owner' });
        }

        const targetAdmins = await User.find({ _id: { $in: normalizedAdminIds } }).select(USER_PUBLIC_FIELDS);
        const currentAdmins = new Set((conversation.admins || []).map(getIdString));
        if (action === 'add') {
            normalizedAdminIds.forEach((adminId) => currentAdmins.add(adminId));
        } else {
            normalizedAdminIds.forEach((adminId) => currentAdmins.delete(adminId));
        }

        conversation.admins = Array.from(currentAdmins);
        conversation.updatedAt = new Date();
        await conversation.save();
        await populateConversationDetails(conversation);
        await createSystemMessageAndEmit(
            req,
            conversation,
            userId,
            action === 'add'
                ? `${getUserLabel(req.user)} made ${targetAdmins.map(getUserLabel).join(', ')} admin`
                : `${getUserLabel(req.user)} removed admin from ${targetAdmins.map(getUserLabel).join(', ')}`
        );

        res.status(200).json({ message: 'Group admins updated successfully', conversation });
    } catch (error) {
        console.error('updateGroupAdmins error:', error);
        res.status(500).json({ message: 'Server error while updating group admins' });
    }
};

const transferGroupOwner = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const { memberId } = req.body;
        const userId = req.user._id;

        if (!memberId) {
            return res.status(400).json({ message: 'Missing memberId' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
        if (conversation.type !== 'group') {
            return res.status(400).json({ message: 'Ownership can only be transferred in a group' });
        }

        if (conversation.createdBy?.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Only the group owner can transfer ownership' });
        }

        const isMember = conversation.members.some(
            id => id.toString() === memberId.toString()
        );
        if (!isMember) {
            return res.status(400).json({ message: 'The new owner must be a group member' });
        }

        if (memberId.toString() === userId.toString()) {
            return res.status(400).json({ message: 'This member is already the group owner' });
        }

        const newOwner = await User.findById(memberId).select(USER_PUBLIC_FIELDS);
        conversation.createdBy = memberId;
        conversation.admins = (conversation.admins || []).filter(
            id => id.toString() !== memberId.toString()
        );
        conversation.updatedAt = new Date();
        await conversation.save();
        await populateConversationDetails(conversation);
        await createSystemMessageAndEmit(
            req,
            conversation,
            userId,
            `${getUserLabel(req.user)} made ${getUserLabel(newOwner)} the group owner`
        );

        res.status(200).json({ message: 'Group owner transferred successfully', conversation });
    } catch (error) {
        console.error('transferGroupOwner error:', error);
        res.status(500).json({ message: 'Server error while transferring group owner' });
    }
};

const leaveGroup = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const userId = req.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
        if (conversation.type !== 'group') {
            return res.status(400).json({ message: 'You can only leave a group chat' });
        }

        const isMember = conversation.members.some(
            id => id.toString() === userId.toString()
        );
        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        const isOwner = isGroupOwner(conversation, userId);
        let newOwner = null;
        if (isOwner && conversation.members.length > 1) {
            const { newOwnerId } = req.body;
            if (!newOwnerId) {
                return res.status(400).json({ message: 'Choose a new group owner before leaving' });
            }

            if (newOwnerId.toString() === userId.toString()) {
                return res.status(400).json({ message: 'New owner must be another member' });
            }

            const isNewOwnerMember = conversation.members.some(
                id => id.toString() === newOwnerId.toString()
            );
            if (!isNewOwnerMember) {
                return res.status(400).json({ message: 'New owner must be a group member' });
            }

            newOwner = await User.findById(newOwnerId).select(USER_PUBLIC_FIELDS);
            conversation.createdBy = newOwnerId;
        }

        conversation.members = conversation.members.filter(
            id => id.toString() !== userId.toString()
        );
        conversation.admins = (conversation.admins || []).filter((id) => {
            const idString = id.toString();
            return idString !== userId.toString() && idString !== getIdString(conversation.createdBy);
        });

        const alreadyDeleted = (conversation.deletedFor || []).some(
            deletedUserId => deletedUserId.toString() === userId.toString()
        );
        if (!alreadyDeleted) {
            conversation.deletedFor.push(userId);
        }

        conversation.deletedAtBy.set(userId.toString(), new Date());
        conversation.unreadCounts.set(userId.toString(), 0);
        conversation.updatedAt = new Date();
        await conversation.save();
        await populateConversationDetails(conversation);

        if (conversation.members.length > 0) {
            await createSystemMessageAndEmit(
                req,
                conversation,
                userId,
                newOwner
                    ? `${getUserLabel(req.user)} left the group. ${getUserLabel(newOwner)} is now the owner`
                    : `${getUserLabel(req.user)} left the group`
            );
        }

        res.status(200).json({
            message: 'You left the group',
            conversationId,
        });
    } catch (error) {
        console.error('leaveGroup error:', error);
        res.status(500).json({ message: 'Server error while leaving group' });
    }
};

module.exports = {
    getConversations,
    getConversationById,
    createConversation,
    deleteConversation,
    markConversationRead,
    uploadGroupAvatar,
    updateGroupDetails,
    addMembers,
    removeMember,
    updateGroupAdmins,
    transferGroupOwner,
    leaveGroup,
};
