const Conversation = require('../models/Conversation');
const User = require('../models/User');

// ─── GET /api/conversations ───────────────────────────────────────────────────
// Lấy danh sách tất cả cuộc trò chuyện của user hiện tại
// Sắp xếp theo updatedAt (mới nhất trước)
const getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        // Tìm tất cả conversation mà user là thành viên
        // populate members để frontend hiển thị info người dùng
        const conversations = await Conversation.find({ members: userId })
            .populate('members', 'username email')
            .populate('createdBy', 'username')
            .sort({ updatedAt: -1 });

        res.status(200).json({ conversations });
    } catch (error) {
        console.error('getConversations error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ─── POST /api/conversations ──────────────────────────────────────────────────
// Tạo cuộc trò chuyện private hoặc group
// Body: { type: 'private' | 'group', name?: string, members: [userId, ...] }
const createConversation = async (req, res) => {
    try {
        const { type, name, members } = req.body;
        const userId = req.user._id;

        // Validate input
        if (!type || !['private', 'group'].includes(type)) {
            return res.status(400).json({ message: 'Type phải là "private" hoặc "group"' });
        }

        if (type === 'group' && !name) {
            return res.status(400).json({ message: 'Group chat phải có tên' });
        }

        if (!members || members.length < 1) {
            return res.status(400).json({ message: 'Phải có ít nhất 1 thành viên' });
        }

        // Đảm bảo userId hiện tại nằm trong members
        const memberSet = new Set([userId.toString(), ...members.map(m => m.toString())]);
        const finalMembers = Array.from(memberSet);

        // Check có private trùng hay chưa
        if (type === 'private') {
            const existing = await Conversation.findOne({
                type: 'private',
                members: { $all: finalMembers, $size: 2 },
            });
            if (existing) {
                return res.status(400).json({ message: 'Private chat đã tồn tại' });
            }
        }

        // Kiểm tra private chat — chỉ 2 thành viên
        if (type === 'private' && finalMembers.length !== 2) {
            return res.status(400).json({ message: 'Private chat phải chỉ có 2 thành viên' });
        }

        // Kiểm tra members tồn tại
        const validUsers = await User.find({ _id: { $in: finalMembers } });
        if (validUsers.length !== finalMembers.length) {
            return res.status(400).json({ message: 'Một số user không tồn tại' });
        }

        // Tạo conversation mới
        const conversation = await Conversation.create({
            type,
            name: type === 'group' ? name : null,
            members: finalMembers,
            createdBy: userId,
        });

        // Populate data trước khi trả về
        await conversation.populate('members', 'username email');
        await conversation.populate('createdBy', 'username');

        res.status(201).json({
            message: 'Tạo cuộc trò chuyện thành công',
            conversation,
        });
    } catch (error) {
        console.error('createConversation error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Xóa group chat
const deleteConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        // Kiểm tra group có tồn tại ko
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm chat' });
        }

        // Nếu là nhóm: chỉ người tạo nhóm mới được xóa
        if (conversation.type === "group" && conversation.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Chỉ chủ nhóm mới có quyền giải tán nhóm' });
        }

        // Thực hiện xóa: Xóa hội thoại và tất cả tin nhắn liên quan
        // Dùng deleteMany để dọn dẹp Message collection
        await Message.deleteMany({ conversationId: conversationId });
        await Conversation.findByIdAndDelete(conversationId);

        res.status(200).json({ 
            message: 'Đã giải tán nhóm và toàn bộ lịch sử tin nhắn',
            conversationId 
        });
    } catch (error) {
        console.error('deleteGroup error:', error);
        res.status(500).json({ message: 'Lỗi server khi xóa nhóm' });
    }
};

// Thêm các thành viên vào group
const addMembers = async (req, res) => {
    try {
        const { conversationId, newMemberIds } = req.body; // newMemberIds là mảng [id1, id2...]
        const userId = req.user._id;

        // Kiểm tra hội thoại có tồn tại và có phải là group ko
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: 'Hội thoại không tồn tại' });
        if (conversation.type !== 'group') {
            return res.status(400).json({ message: 'Chỉ có thể thêm thành viên vào nhóm' });
        }

        // Bỏ người bị trùng
        const currentMembers = conversation.members.map(m => m.toString());
        const toAdd = newMemberIds.filter(id => !currentMembers.includes(id));

        if (toAdd.length === 0) {
            return res.status(400).json({ message: 'Các thành viên này đã ở trong nhóm' });
        }

        // Cập nhật DB
        conversation.members.push(...toAdd);
        conversation.updatedAt = new Date();
        await conversation.save();

        await conversation.populate('members', 'username email');

        res.status(200).json({ message: 'Thêm thành viên thành công', conversation });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Xóa thành viên khỏi group
const removeMember = async (req, res) => {
    try {
        const { conversationId, memberId } = req.body; // MemberId là người bị xóa
        const userId = req.user._id;

        // Kiểm tra hội thoại có tồn tại và có phải là group ko
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: 'Hội thoại không tồn tại' });
        if (conversation.type !== 'group') {
            return res.status(400).json({ message: 'Chỉ có thể xóa thành viên khỏi nhóm' });
        }

        // Check admin
        if (conversation.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa thành viên' });
        }

        // if (!memberId) return res.status(400).json({ message: 'Thiếu memberId' });
        
        // Check người bị xóa có trong nhóm ko
        const exists = conversation.members.some(
            id => id.toString() === memberId
        );
        if (!exists) {
            return res.status(400).json({ message: 'Người dùng này không có trong nhóm' });
        }

        // Xóa khỏi nhóm
        conversation.members = conversation.members.filter(
            id => id.toString() !== memberId
        );

        // Cập nhật DB
        conversation.updatedAt = new Date();
        await conversation.save();

        res.status(200).json({ message: 'Xóa thành viên thành công', conversation });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

module.exports = { getConversations, createConversation, deleteConversation, addMembers, removeMember };