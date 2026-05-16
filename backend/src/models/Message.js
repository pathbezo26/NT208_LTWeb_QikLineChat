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
            required: [true, 'Message content cannot be empty'],
            trim: true,
            maxlength: [5000, 'Message content cannot exceed 5000 characters'],
        },
        deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        replyTo: {
            messageId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Message',
                default: null,
            },
            sender: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                default: null,
            },
            content: {
                type: String,
                default: '',
            },
            createdAt: {
                type: Date,
                default: null,
            },
        },
        forwardedFrom: {
            messageId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Message',
                default: null,
            },
            sender: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                default: null,
            },
            content: {
                type: String,
                default: '',
            },
            createdAt: {
                type: Date,
                default: null,
            },
        },
        deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    { timestamps: true }
);

// Index tối ưu truy vấn lịch sử tin nhắn
MessageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
