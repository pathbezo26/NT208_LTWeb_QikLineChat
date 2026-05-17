const User = require('../models/User');
const Conversation = require('../models/Conversation');
const UserReport = require('../models/UserReport');
const cloudinary = require('../config/cloudinary');

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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

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

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $addToSet: { blockedUsers: targetUserId } },
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
};
