const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const SOCKET_USER_FIELDS = '_id username email avatar'; // Field user gui qua socket, bao gom avatar cho realtime message.

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
    socket.on('sendMessage', async ({ conversationId, content }) => {
      if (!conversationId || !content?.trim()) return;

      try {
        // Save to DB
        const message = await Message.create({
          conversationId,
          sender: userId,
          content: content.trim(),
        });

        // Update conversation's updatedAt for sidebar sorting
        const conversation = await Conversation.findByIdAndUpdate(
          conversationId,
          { updatedAt: new Date() },
          { new: true }
        ).select('members deletedFor');

        // Populate sender info before broadcasting, bao gom avatar cho tin nhan realtime
        const populated = await message.populate('sender', SOCKET_USER_FIELDS);

        // Broadcast to everyone in the room (including sender)
        io.to(conversationId).emit('newMessage', populated);

        if (conversation) {
          const deletedUserIds = new Set(
            (conversation.deletedFor || []).map((deletedUserId) => deletedUserId.toString())
          );

          conversation.members.forEach((memberId) => {
            const memberIdString = memberId.toString();

            if (deletedUserIds.has(memberIdString)) return;

            io.to(`user:${memberIdString}`).emit('conversationUpdated', {
              conversationId,
              senderId: userId,
              messageId: populated._id,
            });
          });
        }
      } catch (err) {
        console.error('Error saving message:', err.message);
        socket.emit('messageError', { message: 'Không thể gửi tin nhắn.' });
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
