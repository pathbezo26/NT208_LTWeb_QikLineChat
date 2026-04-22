import { useState, useEffect } from 'react';
import { getConversationsAPI } from '../api/conversationAPI';
import ChatWindow from '../components/ChatWindow';
import useAuth from '../hooks/useAuth';
import './styles/ChatPage.css';

function ChatPage() {
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Tải danh sách conversation khi component mount
    useEffect(() => {
        loadConversations();
    }, []);

    const loadConversations = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getConversationsAPI();
            setConversations(data.conversations);
            // Tự động chọn conversation đầu tiên nếu có
            if (data.conversations.length > 0) {
                setSelectedConversation(data.conversations[0]);
            }
        } catch (err) {
            setError('Không thể tải danh sách cuộc trò chuyện');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Lấy tên hiển thị của conversation (dùng cho sidebar)
    const getConversationName = (conv) => {
        if (conv.type === 'group') {
            return conv.name;
        }
        // Private chat: hiển thị tên người kia
        const otherUser = conv.members.find(
            (member) => member._id !== user._id
        );
        return otherUser ? otherUser.username : 'Người dùng';
    };

    return (
        <div className="chat-page">
            {/* Sidebar: Danh sách conversation */}
            <aside className="chat-sidebar">
                <div className="sidebar-header">
                    <h2>Tin nhắn</h2>
                    <button className="btn-new-chat" title="Tạo cuộc trò chuyện mới">
                        ➕
                    </button>
                </div>

                {loading && (
                    <div className="sidebar-loading">Đang tải...</div>
                )}

                {error && (
                    <div className="sidebar-error">{error}</div>
                )}

                {conversations.length === 0 && !loading && (
                    <div className="sidebar-empty">
                        Chưa có cuộc trò chuyện nào. Bắt đầu cuộc hội thoại mới!
                    </div>
                )}

                <ul className="conversation-list">
                    {conversations.map((conv) => (
                        <li
                            key={conv._id}
                            className={`conversation-item ${selectedConversation?._id === conv._id ? 'active' : ''
                                }`}
                            onClick={() => setSelectedConversation(conv)}
                        >
                            <div className="conv-avatar">
                                {getConversationName(conv).charAt(0).toUpperCase()}
                            </div>
                            <div className="conv-info">
                                <div className="conv-name">
                                    {getConversationName(conv)}
                                </div>
                                {conv.type === 'group' && (
                                    <div className="conv-members">
                                        {conv.members.length} thành viên
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </aside>

            {/* Main: ChatWindow */}
            <main className="chat-main">
                <ChatWindow conversation={selectedConversation} />
            </main>
        </div>
    );
}

export default ChatPage;
