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
            trim: true,
            default: '',
            maxlength: [5000, 'Message content cannot exceed 5000 characters'],
        },
        attachments: [
            {
                type: {
                    type: String,
                    enum: ['image', 'file'],
                    required: true,
                },
                url: {
                    type: String,
                    required: true,
                },
                publicId: {
                    type: String,
                    default: '',
                },
                name: {
                    type: String,
                    required: true,
                    trim: true,
                },
                size: {
                    type: Number,
                    default: 0,
                },
                mimeType: {
                    type: String,
                    default: '',
                },
                width: {
                    type: Number,
                    default: null,
                },
                height: {
                    type: Number,
                    default: null,
                },
            },
        ],
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

MessageSchema.pre('validate', function validateMessageBody() {
    const hasContent = Boolean(this.content?.trim());
    const hasAttachments = Array.isArray(this.attachments) && this.attachments.length > 0;

    if (!hasContent && !hasAttachments) {
        this.invalidate('content', 'Message content or attachment is required');
    }
});

module.exports = mongoose.model('Message', MessageSchema);
