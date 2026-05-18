const mongoose = require('mongoose');

const ContactRequestSchema = new mongoose.Schema(
    {
        requester: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined', 'cancelled'],
            default: 'pending',
        },
        respondedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

ContactRequestSchema.index(
    { requester: 1, recipient: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: 'pending' },
    }
);
ContactRequestSchema.index({ recipient: 1, status: 1, createdAt: -1 });
ContactRequestSchema.index({ requester: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ContactRequest', ContactRequestSchema);
