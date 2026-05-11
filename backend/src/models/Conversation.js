const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['private', 'group'],
            required: true,
        },
        name: {
            type: String,  // Chỉ dùng cho group chat, null nếu private
            trim: true,
        },
        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
        ],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Danh sách user đã xóa cuộc trò chuyện này (dùng để ẩn với họ nhưng vẫn giữ dữ liệu cho các thành viên khác)
    },
    { timestamps: true }
);

// Index tối ưu sidebar query
ConversationSchema.index({ members: 1, updatedAt: -1 });
ConversationSchema.index({ type: 1, members: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);