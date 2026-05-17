const mongoose = require('mongoose');

const UserReportSchema = new mongoose.Schema(
    {
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        reportedUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        conversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            default: null,
        },
        reason: {
            type: String,
            trim: true,
            maxlength: 120,
            default: 'Inappropriate behavior',
        },
        details: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: '',
        },
        status: {
            type: String,
            enum: ['open', 'reviewed', 'dismissed'],
            default: 'open',
        },
    },
    { timestamps: true }
);

UserReportSchema.index({ reporter: 1, reportedUser: 1, createdAt: -1 });

module.exports = mongoose.model('UserReport', UserReportSchema);
