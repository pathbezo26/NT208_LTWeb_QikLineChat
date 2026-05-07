import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate để chuyển hướng
import { getConversationsAPI } from '../api/conversationAPI';
import ChatWindow from '../components/ChatWindow';
import useAuth from '../hooks/useAuth';
import './styles/ChatPage.css';
import UserFooter from '../components/UserFooter';
import UserSearch from '../components/UserSearch';
import CreateGroupModal from '../components/CreateGroupModal';

function ChatPage() {
    const { user, logout } = useAuth(); 
    const navigate = useNavigate(); // Khởi tạo hook chuyển hướng

    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Tạo conversion
    const [showMenu, setShowMenu] = useState(false); // Tạo menu chọn loại chat
    const [showUserSearch, setShowUserSearch] = useState(false); // Tạo private chat
    const [showCreateGroup, setShowCreateGroup] = useState(false); // Tạo group chat

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

    const handleNewConversation = (newConv) => {
        setConversations(prev => {
            const exists = prev.find(c => c._id === newConv._id);
            if (exists) return prev;
            return [newConv, ...prev];
        });
        setSelectedConversation(newConv);
        setShowMenu(false);
        setShowUserSearch(false);
        setShowCreateGroup(false);
    };

    // --- HÀM XỬ LÝ ĐĂNG XUẤT ---
    const handleLogout = () => {
        if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
            localStorage.removeItem('token'); 
            
            // 2. Nếu có hàm logout từ Context, gọi nó để reset state
            if (logout) {
                logout();
            }

            // 3. Chuyển hướng về trang Login
            navigate('/login');
        }
    };

    return (
        <div className="chat-page">
            {/* Sidebar: Danh sách conversation */}
            <aside className="chat-sidebar">
                <div className="sidebar-header">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h2>Tin nhắn</h2>
                        <span style={{ fontSize: '16px', color: '#666' }}>{user?.username}</span>
                    </div>

                    <div className='new-chat-container'>
                        <button className="btn-new-chat" title="Tạo cuộc trò chuyện mới" onClick={() => setShowMenu(!showMenu)}>
                            ➕
                        </button>

                        {/* NÚT ĐĂNG XUẤT */}
                        <button 
                            title="Đăng xuất" 
                            onClick={handleLogout}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px' }}
                        >
                            🚪
                        </button>

                        {showMenu && (
                            <div className="new-chat-menu">
                                <button onClick={() => { setShowUserSearch(true); setShowMenu(false); }}>
                                    🔍 Tìm người dùng
                                </button>
                                <button onClick={() => { setShowCreateGroup(true); setShowMenu(false); }}>
                                    👥 Tạo nhóm mới
                                </button>
                            </div>
                        )}
                    </div>
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
                <UserFooter />
            </aside>
            
            {showUserSearch && (
                <UserSearch 
                    onClose={() => setShowUserSearch(false)} 
                    onSelect={handleNewConversation} 
                />
            )}

          

            {showCreateGroup && (
                <CreateGroupModal 
                    onClose={() => setShowCreateGroup(false)} 
                    onCreated={handleNewConversation} 
                />
            )}

            {/* Main: ChatWindow */}
            <main className="chat-main">
                <ChatWindow conversation={selectedConversation} />
            </main>
        </div>
    );
}

export default ChatPage;