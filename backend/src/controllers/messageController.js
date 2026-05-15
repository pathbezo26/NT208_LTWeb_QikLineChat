const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Cac field sender duoc tra ve kem tin nhan; avatar giup frontend hien anh nguoi gui.
const SENDER_PUBLIC_FIELDS = 'username avatar';

// ─── GET /api/messages/:conversationId ───────────────────────────────────────
// Lấy toàn bộ lịch sử tin nhắn của 1 conversation
// Frontend gọi khi người dùng mở 1 đoạn chat
const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        // 1. Kiểm tra conversation có tồn tại không
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // 2. Kiểm tra user có phải thành viên của conversation không
        //    Dùng .toString() vì MongoDB trả về ObjectId, cần so sánh với string
        const isMember = conversation.members
            .map((id) => id.toString())
            .includes(userId.toString());

        if (!isMember) {
            return res.status(403).json({ message: 'You do not have permission to view this conversation' });
        }

        // 3. Lấy tin nhắn, sắp xếp từ cũ đến mới (createdAt tăng dần)
        //    populate sender để frontend hiển thị tên và avatar người gửi
        const messages = await Message.find({ conversationId, deletedBy: { $ne: userId } })
            .populate('sender', SENDER_PUBLIC_FIELDS)
            .sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        console.error('getMessages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── POST /api/messages ───────────────────────────────────────────────────────
// Lưu tin nhắn mới vào database
// Được gọi song song với socket.emit để đảm bảo tin nhắn không bị mất
const sendMessage = async (req, res) => {
    try {
        const { conversationId, content } = req.body;
        const userId = req.user._id;

        // 1. Validate đầu vào
        if (!conversationId || !content?.trim()) {
            return res.status(400).json({ message: 'Missing conversationId or message content' });
        }

        // 2. Kiểm tra conversation tồn tại và user là thành viên
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        const isMember = conversation.members
            .map((id) => id.toString())
            .includes(userId.toString());

        if (!isMember) {
            return res.status(403).json({ message: 'You do not have permission to send messages here' });
        }

        // 3. Lưu tin nhắn vào DB
        const message = await Message.create({
            conversationId,
            sender: userId,
            content: content.trim(),
        });

        // 4. Cập nhật updatedAt của conversation
        //    Dùng để Sidebar sort conversation theo tin nhắn mới nhất
        await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });

        // 5. Populate sender rồi trả về — frontend dùng ngay để hiển thị tên/avatar
        const populated = await message.populate('sender', SENDER_PUBLIC_FIELDS);

        res.status(201).json(populated);
    } catch (error) {
        console.error('sendMessage error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getMessages, sendMessage };
