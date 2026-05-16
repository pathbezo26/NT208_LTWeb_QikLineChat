const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { updateConversationAfterMessage } = require('../utils/conversationMeta');
const SOCKET_USER_FIELDS = '_id username email avatar'; // Field user gui qua socket, bao gom avatar cho realtime message.
const MAX_MESSAGE_LENGTH = 5000;

const onlineUsers = new Map(); //Mảng các user đang onl

const socketHandler = (io) => {
  // Authenticate socket on connection
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
    console.log(`🔌 User connected: ${username} (${socket.id})`);

    // Track online users
    onlineUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);
    io.emit('userOnline', { userId, username });

    // Join a conversation room
    socket.on('joinRoom', (conversationId) => {
      socket.join(conversationId);
      console.log(`📌 ${username} joined room: ${conversationId}`);
    });

    // Leave a conversation room
    socket.on('leaveRoom', (conversationId) => {
      socket.leave(conversationId);
      console.log(`🚪 ${username} left room: ${conversationId}`);
    });

    // Handle sending a message
    socket.on('sendMessage', async ({ conversationId, content, clientMessageId }, ack) => {
      const trimmedContent = content?.trim();

      const fail = (message) => {
        if (typeof ack === 'function') ack({ ok: false, message });
      };

      if (!conversationId || !trimmedContent) {
        fail('Missing conversationId or message content.');
        return;
      }

      if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
        fail(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`);
        return;
      }

      try {
        const conversation = await Conversation.findById(conversationId).select('members deletedFor unreadCounts');
        if (!conversation) {
          fail('Conversation not found.');
          return;
        }

        const isMember = conversation.members
          .map((memberId) => memberId.toString())
          .includes(userId);

        if (!isMember) {
          fail('You do not have permission to send messages here.');
          return;
        }

        // Save to DB
        const message = await Message.create({
          conversationId,
          sender: userId,
          content: trimmedContent,
        });

        // Populate sender info before broadcasting, bao gom avatar cho tin nhan realtime
        const populated = await message.populate('sender', SOCKET_USER_FIELDS);
        const payload = {
          ...populated.toObject(),
          clientMessageId,
          status: 'sent',
        };

        // Broadcast to everyone in the room (including sender)
        io.to(conversationId).emit('newMessage', payload);

        await updateConversationAfterMessage(conversation, message, userId);

        conversation.members.forEach((memberId) => {
          const memberIdString = memberId.toString();

          io.to(`user:${memberIdString}`).emit('conversationUpdated', {
            conversationId,
            senderId: userId,
            messageId: populated._id,
          });
        });

        if (typeof ack === 'function') ack({ ok: true, message: payload });
      } catch (err) {
        console.error('Error saving message:', err.message);
        socket.emit('messageError', { message: 'Could not send message.' });
        fail('Could not send message.');
      }
    });

    // Typing indicators
    socket.on('typing', ({ conversationId }) => {
      socket.to(conversationId).emit('typing', { userId, username });
    });

    socket.on('stopTyping', ({ conversationId }) => {
      socket.to(conversationId).emit('stopTyping', { userId });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${username}`);
      onlineUsers.delete(userId);
      io.emit('userOffline', { userId, username });
    });
  });
};

module.exports = socketHandler;
