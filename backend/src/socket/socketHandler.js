const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { updateConversationAfterMessage } = require('../utils/conversationMeta');
const logger = require('../utils/logger');

const SOCKET_USER_FIELDS = '_id username email avatar';
const MAX_MESSAGE_LENGTH = 5000;
const MAX_ATTACHMENTS_PER_MESSAGE = 5;
const SEND_MESSAGE_LIMIT_WINDOW_MS = 60 * 1000;
const SEND_MESSAGE_LIMIT_MAX = 60;

const onlineUsers = new Map();

const isConversationMember = (conversation, userId) => {
  return conversation.members
    .map((memberId) => memberId.toString())
    .includes(userId.toString());
};

const addOnlineSocket = (userId, socketId) => {
  const socketIds = onlineUsers.get(userId) || new Set();
  socketIds.add(socketId);
  onlineUsers.set(userId, socketIds);
  return socketIds.size === 1;
};

const removeOnlineSocket = (userId, socketId) => {
  const socketIds = onlineUsers.get(userId);
  if (!socketIds) return false;

  socketIds.delete(socketId);
  if (socketIds.size > 0) return false;

  onlineUsers.delete(userId);
  return true;
};

const isUserOnline = (userId) => {
  return onlineUsers.has(userId.toString());
};

const getConversationForMember = (conversationId, userId, fields = 'members') => {
  if (!conversationId) return null;

  return Conversation.findOne({
    _id: conversationId,
    members: userId,
  }).select(fields);
};

const emitPresenceToConversationMembers = async (io, userId, eventName, payload) => {
  const conversations = await Conversation.find({ members: userId })
    .select('members')
    .lean();
  const recipientIds = new Set();

  conversations.forEach((conversation) => {
    conversation.members.forEach((memberId) => {
      const memberIdString = memberId.toString();
      if (memberIdString !== userId) {
        recipientIds.add(memberIdString);
      }
    });
  });

  recipientIds.forEach((memberId) => {
    io.to(`user:${memberId}`).emit(eventName, payload);
  });
};

const emitToConversationMembers = (io, members, eventName, payload, excludedUserId = null) => {
  members.forEach((memberId) => {
    const memberIdString = memberId.toString();
    if (excludedUserId && memberIdString === excludedUserId) return;

    io.to(`user:${memberIdString}`).emit(eventName, payload);
  });
};

const buildMessageReference = (sourceMessage) => {
  if (!sourceMessage) return undefined;

  return {
    messageId: sourceMessage._id,
    sender: sourceMessage.sender,
    content: sourceMessage.content,
    createdAt: sourceMessage.createdAt,
  };
};

const normalizeAttachments = (attachments = []) => {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
    .filter((attachment) => attachment?.url && attachment?.name)
    .map((attachment) => ({
      type: attachment.type === 'image' ? 'image' : 'file',
      url: attachment.url,
      publicId: attachment.publicId || '',
      name: attachment.name,
      size: Number(attachment.size) || 0,
      mimeType: attachment.mimeType || '',
      width: Number(attachment.width) || null,
      height: Number(attachment.height) || null,
    }));
};

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

const populateSocketMessage = (message) => {
  return message.populate([
    { path: 'sender', select: SOCKET_USER_FIELDS },
    { path: 'replyTo.sender', select: SOCKET_USER_FIELDS },
    { path: 'forwardedFrom.sender', select: SOCKET_USER_FIELDS },
  ]);
};

const isSocketRateLimited = (socket, key, limit, windowMs) => {
  const now = Date.now();
  const rateLimits = socket.data.rateLimits || {};
  const current = rateLimits[key] || { count: 0, resetAt: now + windowMs };

  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + windowMs;
  }

  current.count += 1;
  rateLimits[key] = current;
  socket.data.rateLimits = rateLimits;

  return current.count > limit;
};

const socketHandler = (io) => {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error: No token'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id username');
      if (!user) return next(new Error('Authentication error: User not found'));

      socket.user = {
        id: user._id.toString(),
        username: user.username,
      };
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, username } = socket.user;
    const becameOnline = addOnlineSocket(userId, socket.id);

    socket.data.joinedConversations = new Set();
    socket.join(`user:${userId}`);
    logger.info(`User connected: ${username} (${socket.id})`);

    if (becameOnline) {
      emitPresenceToConversationMembers(io, userId, 'userOnline', { userId, username })
        .catch((error) => logger.error('userOnline emit error:', error));
    }

    socket.on('joinRoom', async (conversationId, ack) => {
      try {
        const conversation = await getConversationForMember(conversationId, userId);
        if (!conversation) {
          if (typeof ack === 'function') ack({ ok: false, message: 'Conversation not found.' });
          return;
        }

        socket.join(conversationId);
        socket.data.joinedConversations.add(conversationId);
        if (typeof ack === 'function') ack({ ok: true });
        logger.info(`${username} joined room: ${conversationId}`);
      } catch (error) {
        logger.error('joinRoom error:', error);
        if (typeof ack === 'function') ack({ ok: false, message: 'Could not join conversation.' });
      }
    });

    socket.on('leaveRoom', (conversationId) => {
      socket.leave(conversationId);
      socket.data.joinedConversations.delete(conversationId);
      logger.info(`${username} left room: ${conversationId}`);
    });

    socket.on('sendMessage', async ({ conversationId, content, attachments: rawAttachments, clientMessageId, replyToMessageId, forwardedFromMessageId }, ack) => {
      const trimmedContent = content?.trim();
      const attachments = normalizeAttachments(rawAttachments);

      const fail = (message) => {
        if (typeof ack === 'function') ack({ ok: false, message });
      };

      if (!conversationId || (!trimmedContent && attachments.length === 0 && !forwardedFromMessageId)) {
        fail('Missing conversationId, message content, or attachment.');
        return;
      }

      if (isSocketRateLimited(socket, 'sendMessage', SEND_MESSAGE_LIMIT_MAX, SEND_MESSAGE_LIMIT_WINDOW_MS)) {
        fail('Too many messages. Please slow down.');
        return;
      }

      if ((trimmedContent || '').length > MAX_MESSAGE_LENGTH) {
        fail(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`);
        return;
      }

      try {
        const conversation = await Conversation.findById(conversationId).select('members deletedFor unreadCounts');
        if (!conversation) {
          fail('Conversation not found.');
          return;
        }

        if (!isConversationMember(conversation, userId)) {
          fail('You do not have permission to send messages here.');
          return;
        }

        const [replyToMessage, forwardedFromMessage] = await Promise.all([
          replyToMessageId
            ? Message.findOne({ _id: replyToMessageId, conversationId })
            : null,
          forwardedFromMessageId
            ? Message.findById(forwardedFromMessageId)
            : null,
        ]);

        if (replyToMessageId && !replyToMessage) {
          fail('Reply source message not found.');
          return;
        }

        if (forwardedFromMessageId && !forwardedFromMessage) {
          fail('Forward source message not found.');
          return;
        }

        if (forwardedFromMessage) {
          const sourceConversation = await Conversation.findById(forwardedFromMessage.conversationId).select('members');
          if (!sourceConversation || !isConversationMember(sourceConversation, userId)) {
            fail('You do not have permission to forward this message.');
            return;
          }
        }

        const messageData = {
          conversationId,
          sender: userId,
          content: trimmedContent || '',
          attachments,
          deliveredTo: [
            userId,
            ...conversation.members
              .map((memberId) => memberId.toString())
              .filter((memberId) => memberId !== userId && isUserOnline(memberId)),
          ],
          readBy: [userId],
        };

        if (replyToMessage) {
          messageData.replyTo = buildMessageReference(replyToMessage);
        }

        if (forwardedFromMessage) {
          messageData.forwardedFrom = buildMessageReference(forwardedFromMessage);
          messageData.attachments = normalizeAttachments(forwardedFromMessage.attachments);
        }

        const message = await Message.create(messageData);
        const populated = await populateSocketMessage(message);
        const payload = {
          ...populated.toObject(),
          clientMessageId,
          status: 'sent',
        };

        emitToConversationMembers(io, conversation.members, 'newMessage', payload);

        const updatedConversation = await updateConversationAfterMessage(conversation, message, userId);

        conversation.members.forEach((memberId) => {
          const memberIdString = memberId.toString();
          const unreadCount = updatedConversation?.unreadCounts?.get(memberIdString) || 0;

          io.to(`user:${memberIdString}`).emit('conversationUpdated', {
            conversationId,
            senderId: userId,
            messageId: populated._id,
            unreadCount,
            updatedAt: updatedConversation?.updatedAt || message.createdAt,
            lastMessage: {
              messageId: populated._id,
              sender: populated.sender,
              content: getMessagePreviewContent(populated),
              createdAt: populated.createdAt,
            },
          });
        });

        if (typeof ack === 'function') ack({ ok: true, message: payload });
      } catch (err) {
        logger.error('Error saving message:', err);
        const errorMessage = err.message || 'Could not send message.';
        socket.emit('messageError', { message: errorMessage });
        fail(errorMessage);
      }
    });

    socket.on('markMessagesRead', async ({ conversationId }, ack) => {
      if (!conversationId) {
        if (typeof ack === 'function') ack({ ok: false, message: 'Missing conversationId.' });
        return;
      }

      try {
        const conversation = await Conversation.findById(conversationId).select('members');
        if (!conversation || !isConversationMember(conversation, userId)) {
          if (typeof ack === 'function') ack({ ok: false, message: 'Conversation not found.' });
          return;
        }

        await Conversation.findByIdAndUpdate(conversationId, {
          [`unreadCounts.${userId}`]: 0,
        });

        const updateResult = await Message.updateMany(
          {
            conversationId,
            sender: { $ne: userId },
            deletedBy: { $ne: userId },
          },
          {
            $addToSet: {
              deliveredTo: userId,
              readBy: userId,
            },
          }
        );

        emitToConversationMembers(io, conversation.members, 'messageStatusUpdated', {
          conversationId,
          userId,
          status: 'read',
        });

        if (typeof ack === 'function') {
          ack({ ok: true, modifiedCount: updateResult.modifiedCount || 0 });
        }
      } catch (err) {
        logger.error('Error marking messages read:', err.message);
        if (typeof ack === 'function') ack({ ok: false, message: 'Could not mark messages read.' });
      }
    });

    const emitTypingStatus = async ({ conversationId }, eventName, payload, ack) => {
      try {
        const conversation = await getConversationForMember(conversationId, userId);
        if (!conversation) {
          if (typeof ack === 'function') ack({ ok: false, message: 'Conversation not found.' });
          return;
        }

        emitToConversationMembers(io, conversation.members, eventName, payload, userId);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        logger.error(`${eventName} error:`, error);
        if (typeof ack === 'function') ack({ ok: false, message: 'Could not send typing status.' });
      }
    };

    socket.on('typing', (data, ack) => {
      emitTypingStatus(data || {}, 'typing', { userId, username }, ack);
    });

    socket.on('stopTyping', (data, ack) => {
      emitTypingStatus(data || {}, 'stopTyping', { userId }, ack);
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${username}`);
      const becameOffline = removeOnlineSocket(userId, socket.id);
      if (becameOffline) {
        emitPresenceToConversationMembers(io, userId, 'userOffline', { userId, username })
          .catch((error) => logger.error('userOffline emit error:', error));
      }
    });
  });
};

module.exports = socketHandler;
