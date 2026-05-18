const User = require('../models/User');
const Conversation = require('../models/Conversation');
const ContactRequest = require('../models/ContactRequest');
const UserReport = require('../models/UserReport');
const cloudinary = require('../config/cloudinary');

const USER_CONTACT_FIELDS = '_id username email avatar lastSeenAt';

const getPublicUser = (user) => ({
    _id: user._id,
    username: user.username,
    email: user.email,
    avatar: {
        url: user.avatar?.url || null,
        publicId: user.avatar?.publicId || null,
        updatedAt: user.avatar?.updatedAt || null,
    },
    lastSeenAt: user.lastSeenAt,
    blockedUsers: user.blockedUsers || [],
    contacts: user.contacts || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

const getIdString = (value) => {
    if (!value) return '';
    return typeof value === 'object' ? (value._id || value.id || value).toString() : value.toString();
};

const mapContactUser = (contact) => ({
    _id: contact._id,
    username: contact.username,
    email: contact.email,
    avatar: contact.avatar,
    lastSeenAt: contact.lastSeenAt,
});

const getContactRequestPayload = (request, currentUserId) => {
    const currentUserIdString = currentUserId.toString();
    const requesterId = getIdString(request.requester);
    const recipientId = getIdString(request.recipient);

    return {
        _id: request._id,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        respondedAt: request.respondedAt,
        direction: requesterId === currentUserIdString ? 'outgoing' : 'incoming',
        requester: request.requester,
        recipient: request.recipient,
        otherUser: requesterId === currentUserIdString ? request.recipient : request.requester,
        requesterId,
        recipientId,
    };
};

const getRelationshipStatusMap = async (currentUser, users) => {
    const userIds = users.map((user) => user._id.toString());
    const contactIds = new Set((currentUser.contacts || []).map(getIdString));
    const requests = await ContactRequest.find({
        status: 'pending',
        $or: [
            { requester: currentUser._id, recipient: { $in: userIds } },
            { requester: { $in: userIds }, recipient: currentUser._id },
        ],
    }).lean();
    const statusMap = new Map();

    userIds.forEach((userId) => {
        statusMap.set(userId, contactIds.has(userId) ? 'contact' : 'none');
    });

    requests.forEach((request) => {
        const requesterId = request.requester.toString();
        const recipientId = request.recipient.toString();
        const otherUserId = requesterId === currentUser._id.toString() ? recipientId : requesterId;

        statusMap.set(
            otherUserId,
            requesterId === currentUser._id.toString() ? 'outgoing_pending' : 'incoming_pending'
        );
    });

    return statusMap;
};

const emitContactEvent = (req, userId, eventName, payload) => {
    req.app.get('io')?.to(`user:${userId.toString()}`).emit(eventName, payload);
};

const uploadBufferToCloudinary = (fileBuffer, userId) => {
    return new Promise((resolve, reject) => {
        // Upload stream cho phep day file tu memory cua multer len Cloudinary, khong can luu file tam tren server.
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'qikline/avatars',
                public_id: `user_${userId}_${Date.now()}`,
                resource_type: 'image',
                overwrite: true,
                transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
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

const hasCloudinaryConfig = () => {
    return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
};

// PATCH /api/users/me/username
// Doi username cua user hien tai, validate trung username truoc khi luu.
const updateUsername = async (req, res) => {
    try {
        const username = req.body.username?.trim();

        if (!username) {
            return res.status(400).json({ message: 'Please enter a username' });
        }

        if (username.length < 3 || username.length > 30) {
            return res.status(400).json({ message: 'Username must be 3 to 30 characters' });
        }

        const existingUser = await User.findOne({
            username,
            _id: { $ne: req.user._id },
        });

        if (existingUser) {
            return res.status(409).json({ message: 'Username is already taken' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.username = username;
        await user.save();

        res.status(200).json({
            message: 'Username updated successfully',
            user: getPublicUser(user),
        });
    } catch (error) {
        console.error('Update username error:', error);
        res.status(500).json({ message: 'Server error while updating username' });
    }
};

// PATCH /api/users/me/avatar
// Nhan file avatar tu frontend, upload len Cloudinary, roi chi luu URL/publicId vao MongoDB.
const uploadAvatar = async (req, res) => {
    try {
        if (!hasCloudinaryConfig()) {
            return res.status(500).json({ message: 'Cloudinary is not configured on the server' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please select an avatar image' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const oldAvatarPublicId = user.avatar?.publicId;
        const uploadedAvatar = await uploadBufferToCloudinary(req.file.buffer, user._id);

        user.avatar = {
            url: uploadedAvatar.secure_url,
            publicId: uploadedAvatar.public_id,
            updatedAt: new Date(),
        };

        await user.save();

        // Xoa anh cu sau khi DB da luu anh moi; neu cleanup loi thi khong lam hong ket qua upload.
        if (oldAvatarPublicId) {
            cloudinary.uploader.destroy(oldAvatarPublicId).catch((error) => {
                console.error('Delete old avatar error:', error);
            });
        }

        res.status(200).json({
            message: 'Avatar updated successfully',
            user: getPublicUser(user),
        });
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ message: 'Server error while updating avatar' });
    }
};

// DELETE /api/users/me/avatar
// Xoa avatar tren Cloudinary va xoa metadata avatar trong MongoDB.
const deleteAvatar = async (req, res) => {
    try {
        if (!hasCloudinaryConfig()) {
            return res.status(500).json({ message: 'Cloudinary is not configured on the server' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.avatar?.publicId) {
            await cloudinary.uploader.destroy(user.avatar.publicId);
        }

        user.avatar = {
            url: null,
            publicId: null,
            updatedAt: null,
        };

        await user.save();

        res.status(200).json({
            message: 'Avatar deleted successfully',
            user: getPublicUser(user),
        });
    } catch (error) {
        console.error('Delete avatar error:', error);
        res.status(500).json({ message: 'Server error while deleting avatar' });
    }
};

const blockUser = async (req, res) => {
    try {
        const targetUserId = req.params.id;

        if (targetUserId === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot block yourself' });
        }

        const targetUser = await User.findById(targetUserId).select('_id username avatar lastSeenAt');
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        await ContactRequest.updateMany(
            {
                status: 'pending',
                $or: [
                    { requester: req.user._id, recipient: targetUserId },
                    { requester: targetUserId, recipient: req.user._id },
                ],
            },
            { status: 'cancelled', respondedAt: new Date() }
        );

        await User.findByIdAndUpdate(targetUserId, {
            $pull: { contacts: req.user._id },
        });

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $addToSet: { blockedUsers: targetUserId },
                $pull: { contacts: targetUserId },
            },
            { new: true }
        ).select('_id username email avatar lastSeenAt blockedUsers');

        res.status(200).json({
            message: `${targetUser.username} has been blocked`,
            user: getPublicUser(user),
        });
    } catch (error) {
        console.error('blockUser error:', error);
        res.status(500).json({ message: 'Server error while blocking user' });
    }
};

const getContacts = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('contacts')
            .populate('contacts', USER_CONTACT_FIELDS);

        const [incomingRequests, outgoingRequests] = await Promise.all([
            ContactRequest.find({ recipient: req.user._id, status: 'pending' })
                .populate('requester', USER_CONTACT_FIELDS)
                .populate('recipient', USER_CONTACT_FIELDS)
                .sort({ createdAt: -1 }),
            ContactRequest.find({ requester: req.user._id, status: 'pending' })
                .populate('requester', USER_CONTACT_FIELDS)
                .populate('recipient', USER_CONTACT_FIELDS)
                .sort({ createdAt: -1 }),
        ]);

        res.status(200).json({
            contacts: (user?.contacts || []).map(mapContactUser),
            incomingRequests: incomingRequests.map((request) => getContactRequestPayload(request, req.user._id)),
            outgoingRequests: outgoingRequests.map((request) => getContactRequestPayload(request, req.user._id)),
        });
    } catch (error) {
        console.error('getContacts error:', error);
        res.status(500).json({ message: 'Server error while loading contacts' });
    }
};

const sendContactRequest = async (req, res) => {
    try {
        const targetUserId = req.params.id;

        if (targetUserId === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot add yourself' });
        }

        const [currentUser, targetUser] = await Promise.all([
            User.findById(req.user._id).select('contacts blockedUsers username avatar email lastSeenAt'),
            User.findById(targetUserId).select('contacts blockedUsers username avatar email lastSeenAt'),
        ]);

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const currentBlocksTarget = currentUser.blockedUsers?.some((id) => id.toString() === targetUserId);
        const targetBlocksCurrent = targetUser.blockedUsers?.some((id) => id.toString() === req.user._id.toString());
        if (currentBlocksTarget || targetBlocksCurrent) {
            return res.status(403).json({ message: 'You cannot add this user' });
        }

        const alreadyContact = currentUser.contacts?.some((id) => id.toString() === targetUserId);
        if (alreadyContact) {
            return res.status(409).json({ message: 'This user is already in your contacts' });
        }

        const reverseRequest = await ContactRequest.findOne({
            requester: targetUserId,
            recipient: req.user._id,
            status: 'pending',
        });

        if (reverseRequest) {
            await Promise.all([
                User.findByIdAndUpdate(req.user._id, { $addToSet: { contacts: targetUserId } }),
                User.findByIdAndUpdate(targetUserId, { $addToSet: { contacts: req.user._id } }),
            ]);

            reverseRequest.status = 'accepted';
            reverseRequest.respondedAt = new Date();
            await reverseRequest.save();

            emitContactEvent(req, targetUserId, 'contactRequestAccepted', {
                contact: mapContactUser(currentUser),
                requestId: reverseRequest._id,
            });
            emitContactEvent(req, req.user._id, 'contactRequestAccepted', {
                contact: mapContactUser(targetUser),
                requestId: reverseRequest._id,
            });

            return res.status(200).json({
                message: 'Contact request accepted',
                contact: mapContactUser(targetUser),
                request: getContactRequestPayload(reverseRequest, req.user._id),
            });
        }

        const existingRequest = await ContactRequest.findOne({
            requester: req.user._id,
            recipient: targetUserId,
            status: 'pending',
        })
            .populate('requester', USER_CONTACT_FIELDS)
            .populate('recipient', USER_CONTACT_FIELDS);

        if (existingRequest) {
            return res.status(200).json({
                message: 'Contact request already sent',
                request: getContactRequestPayload(existingRequest, req.user._id),
            });
        }

        const request = await ContactRequest.create({
            requester: req.user._id,
            recipient: targetUserId,
        });

        await request.populate('requester', USER_CONTACT_FIELDS);
        await request.populate('recipient', USER_CONTACT_FIELDS);

        emitContactEvent(req, targetUserId, 'contactRequestReceived', {
            request: getContactRequestPayload(request, targetUserId),
        });

        res.status(201).json({
            message: 'Contact request sent',
            request: getContactRequestPayload(request, req.user._id),
        });
    } catch (error) {
        console.error('sendContactRequest error:', error);
        res.status(500).json({ message: 'Server error while sending contact request' });
    }
};

const acceptContactRequest = async (req, res) => {
    try {
        const request = await ContactRequest.findOne({
            _id: req.params.requestId,
            recipient: req.user._id,
            status: 'pending',
        })
            .populate('requester', USER_CONTACT_FIELDS)
            .populate('recipient', USER_CONTACT_FIELDS);

        if (!request) {
            return res.status(404).json({ message: 'Contact request not found' });
        }

        await Promise.all([
            User.findByIdAndUpdate(request.requester._id, { $addToSet: { contacts: request.recipient._id } }),
            User.findByIdAndUpdate(request.recipient._id, { $addToSet: { contacts: request.requester._id } }),
        ]);

        request.status = 'accepted';
        request.respondedAt = new Date();
        await request.save();

        emitContactEvent(req, request.requester._id, 'contactRequestAccepted', {
            contact: mapContactUser(request.recipient),
            requestId: request._id,
        });
        emitContactEvent(req, request.recipient._id, 'contactRequestAccepted', {
            contact: mapContactUser(request.requester),
            requestId: request._id,
        });

        res.status(200).json({
            message: 'Contact request accepted',
            contact: mapContactUser(request.requester),
            request: getContactRequestPayload(request, req.user._id),
        });
    } catch (error) {
        console.error('acceptContactRequest error:', error);
        res.status(500).json({ message: 'Server error while accepting contact request' });
    }
};

const declineContactRequest = async (req, res) => {
    try {
        const request = await ContactRequest.findOne({
            _id: req.params.requestId,
            recipient: req.user._id,
            status: 'pending',
        });

        if (!request) {
            return res.status(404).json({ message: 'Contact request not found' });
        }

        request.status = 'declined';
        request.respondedAt = new Date();
        await request.save();

        emitContactEvent(req, request.requester, 'contactRequestDeclined', {
            requestId: request._id,
            userId: req.user._id,
        });

        res.status(200).json({ message: 'Contact request declined', requestId: request._id });
    } catch (error) {
        console.error('declineContactRequest error:', error);
        res.status(500).json({ message: 'Server error while declining contact request' });
    }
};

const cancelContactRequest = async (req, res) => {
    try {
        const request = await ContactRequest.findOne({
            _id: req.params.requestId,
            requester: req.user._id,
            status: 'pending',
        });

        if (!request) {
            return res.status(404).json({ message: 'Contact request not found' });
        }

        request.status = 'cancelled';
        request.respondedAt = new Date();
        await request.save();

        emitContactEvent(req, request.recipient, 'contactRequestCancelled', {
            requestId: request._id,
            userId: req.user._id,
        });

        res.status(200).json({ message: 'Contact request cancelled', requestId: request._id });
    } catch (error) {
        console.error('cancelContactRequest error:', error);
        res.status(500).json({ message: 'Server error while cancelling contact request' });
    }
};

const removeContact = async (req, res) => {
    try {
        const targetUserId = req.params.id;

        if (targetUserId === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot remove yourself' });
        }

        const targetUser = await User.findById(targetUserId).select('_id');
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        await Promise.all([
            User.findByIdAndUpdate(req.user._id, { $pull: { contacts: targetUserId } }),
            User.findByIdAndUpdate(targetUserId, { $pull: { contacts: req.user._id } }),
        ]);

        emitContactEvent(req, targetUserId, 'contactRemoved', { userId: req.user._id });

        res.status(200).json({ message: 'Contact removed', userId: targetUserId });
    } catch (error) {
        console.error('removeContact error:', error);
        res.status(500).json({ message: 'Server error while removing contact' });
    }
};

const unblockUser = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $pull: { blockedUsers: targetUserId } },
            { new: true }
        ).select('_id username email avatar lastSeenAt blockedUsers');

        res.status(200).json({
            message: 'User has been unblocked',
            user: getPublicUser(user),
        });
    } catch (error) {
        console.error('unblockUser error:', error);
        res.status(500).json({ message: 'Server error while unblocking user' });
    }
};

const reportUser = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const { conversationId, reason, details } = req.body;

        if (targetUserId === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot report yourself' });
        }

        const targetUser = await User.findById(targetUserId).select('_id');
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (conversationId) {
            const conversation = await Conversation.findOne({
                _id: conversationId,
                members: { $all: [req.user._id, targetUserId] },
            }).select('_id');

            if (!conversation) {
                return res.status(403).json({ message: 'Conversation not found for this report' });
            }
        }

        const report = await UserReport.create({
            reporter: req.user._id,
            reportedUser: targetUserId,
            conversation: conversationId || null,
            reason: reason?.trim() || 'Inappropriate behavior',
            details: details?.trim() || '',
        });

        res.status(201).json({
            message: 'Report submitted',
            reportId: report._id,
        });
    } catch (error) {
        console.error('reportUser error:', error);
        res.status(500).json({ message: 'Server error while reporting user' });
    }
};

module.exports = {
    uploadAvatar,
    deleteAvatar,
    updateUsername,
    blockUser,
    unblockUser,
    reportUser,
    getContacts,
    sendContactRequest,
    acceptContactRequest,
    declineContactRequest,
    cancelContactRequest,
    removeContact,
    getRelationshipStatusMap,
};
