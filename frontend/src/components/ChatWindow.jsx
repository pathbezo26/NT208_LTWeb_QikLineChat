import { useState, useEffect } from 'react';
import { getMessagesAPI, sendMessageAPI } from '../api/messageAPI';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import useAuth from '../hooks/useAuth';
import './styles/ChatWindow.css';

// Props:
// conversation — object conversation đang được chọn
//   { _id, type, name, members: [{_id, username}] }
function ChatWindow({ conversation }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Mỗi khi đổi sang conversation khác → tải lịch sử tin nhắn mới
    useEffect(() => {
        if (!conversation) return;
        loadMessages();
    }, [conversation?._id]); // Chỉ chạy lại khi _id thay đổi

    const loadMessages = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getMessagesAPI(conversation._id);
            setMessages(data.messages);
        } catch (err) {
            setError('Không thể tải tin nhắn. Thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    // Gửi tin nhắn mới
    const handleSend = async (content) => {
        try {
            const data = await sendMessageAPI(conversation._id, content);
            // Thêm tin nhắn mới vào cuối danh sách
            setMessages((prev) => [...prev, data.message]);
        } catch (err) {
            alert('Gửi tin nhắn thất bại. Vui lòng thử lại.');
        }
    };

    // Lấy tên hiển thị của conversation
    const getConversationTitle = () => {
        if (!conversation) return '';
        if (conversation.type === 'group') return conversation.name;

        // Private chat → hiển thị tên của người kia (không phải mình)
        const other = conversation.members.find((m) => m._id !== user._id);
        return other?.username || 'Unknown';
    };

    // Lấy chữ cái đầu để làm avatar
    const getAvatarLetter = () => {
        const title = getConversationTitle();
        return title.charAt(0).toUpperCase();
    };

    // Chưa chọn conversation nào → hiển thị màn hình chào
    if (!conversation) {
        return (
            <div className="chat-window chat-window-empty">
                <div className="empty-state">
                    <span>💬</span>
                    <h3>Chào mừng đến QikLine!</h3>
                    <p>Chọn một cuộc trò chuyện để bắt đầu nhắn tin</p>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-window">

            {/* Header: tên conversation + thông tin */}
            <div className="chat-header">
                <div className="chat-header-avatar">
                    {conversation.type === 'group' ? '👥' : getAvatarLetter()}
                </div>
                <div className="chat-header-info">
                    <span className="chat-header-title">{getConversationTitle()}</span>
                    <span className="chat-header-sub">
                        {conversation.type === 'group'
                            ? `${conversation.members.length} thành viên`
                            : 'Tin nhắn riêng tư'}
                    </span>
                </div>
            </div>

            {/* Nội dung chính */}
            <div className="chat-body">
                {loading && <div className="chat-loading">Đang tải tin nhắn...</div>}
                {error && <div className="chat-error">{error}</div>}
                {!loading && !error && (
                    <MessageList messages={messages} />
                )}
            </div>

            {/* Ô nhập tin nhắn */}
            <ChatInput onSend={handleSend} disabled={loading} />

        </div>
    );
}

export default ChatWindow;
