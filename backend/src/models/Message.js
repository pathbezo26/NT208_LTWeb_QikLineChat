const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        content: {
            type: String,
            required: [true, 'Nội dung tin nhắn không được rỗng'],
            trim: true,
        },
    },
    { timestamps: true }
);

// Index tối ưu truy vấn lịch sử tin nhắn
MessageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);