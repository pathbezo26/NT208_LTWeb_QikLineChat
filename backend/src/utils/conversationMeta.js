const Conversation = require('../models/Conversation');

const getMessagePreviewContent = (message) => {
    const content = message.content?.trim();
    if (content) return content;

    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    if (attachments.length === 0) return '';

    const hasImage = attachments.some((attachment) => attachment.type === 'image');
    if (hasImage && attachments.length === 1) return 'Photo';
    if (hasImage) return `${attachments.length} attachments`;

    return attachments.length === 1 ? 'File' : `${attachments.length} files`;
};

const buildMessageMetaUpdate = (conversation, message, senderId) => {
    const senderIdString = senderId.toString();
    const setUpdates = {
        updatedAt: new Date(),
        lastMessage: {
            messageId: message._id,
            sender: senderId,
            content: getMessagePreviewContent(message),
            createdAt: message.createdAt,
        },
        [`unreadCounts.${senderIdString}`]: 0,
    };
    const incUpdates = {};

    conversation.members.forEach((memberId) => {
        const memberIdString = memberId.toString();

        if (memberIdString === senderIdString) {
            return;
        }

        incUpdates[`unreadCounts.${memberIdString}`] = 1;
    });

    const update = { $set: setUpdates };

    if (Object.keys(incUpdates).length > 0) {
        update.$inc = incUpdates;
    }

    update.$pull = {
        deletedFor: { $in: conversation.members },
    };

    return update;
};

const updateConversationAfterMessage = async (conversation, message, senderId) => {
    return Conversation.findByIdAndUpdate(
        conversation._id,
        buildMessageMetaUpdate(conversation, message, senderId),
        { returnDocument: 'after' }
    );
};

module.exports = {
    updateConversationAfterMessage,
};
