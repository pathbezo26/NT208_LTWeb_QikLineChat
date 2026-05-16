const Conversation = require('../models/Conversation');

const buildMessageMetaUpdate = (conversation, message, senderId) => {
    const senderIdString = senderId.toString();
    const setUpdates = {
        updatedAt: new Date(),
        lastMessage: {
            messageId: message._id,
            sender: senderId,
            content: message.content,
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
