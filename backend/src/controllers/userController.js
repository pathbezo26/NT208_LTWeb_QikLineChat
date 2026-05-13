const User = require('../models/User');
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

// PATCH /api/users/me/avatar
// Nhan file avatar tu frontend, upload len Cloudinary, roi chi luu URL/publicId vao MongoDB.
const uploadAvatar = async (req, res) => {
    try {
        if (!hasCloudinaryConfig()) {
            return res.status(500).json({ message: 'Chưa cấu hình Cloudinary cho server' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn ảnh avatar' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User không tồn tại' });
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
            message: 'Cập nhật avatar thành công',
            user: getPublicUser(user),
        });
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ message: 'Lỗi server khi cập nhật avatar' });
    }
};

// DELETE /api/users/me/avatar
// Xoa avatar tren Cloudinary va xoa metadata avatar trong MongoDB.
const deleteAvatar = async (req, res) => {
    try {
        if (!hasCloudinaryConfig()) {
            return res.status(500).json({ message: 'Chưa cấu hình Cloudinary cho server' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User không tồn tại' });
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
            message: 'Xóa avatar thành công',
            user: getPublicUser(user),
        });
    } catch (error) {
        console.error('Delete avatar error:', error);
        res.status(500).json({ message: 'Lỗi server khi xóa avatar' });
    }
};

module.exports = { uploadAvatar, deleteAvatar };
