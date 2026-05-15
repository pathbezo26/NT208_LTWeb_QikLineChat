const Conversation = require('../models/Conversation');

const buildMessageMetaUpdate = (conversation, message, senderId) => {
    const senderIdString = senderId.toString();
    const unreadUpdates = {};

    conversation.members.forEach((memberId) => {
        const memberIdString = memberId.toString();

        if (memberIdString === senderIdString) {
            unreadUpdates[`unreadCounts.${memberIdString}`] = 0;
            return;
        }

        const currentUnread = conversation.unreadCounts?.get(memberIdString) || 0;
        unreadUpdates[`unreadCounts.${memberIdString}`] = currentUnread + 1;
    });

    return {
        updatedAt: new Date(),
        lastMessage: {
            messageId: message._id,
            sender: senderId,
            content: message.content,
            createdAt: message.createdAt,
        },
        ...unreadUpdates,
    };
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
