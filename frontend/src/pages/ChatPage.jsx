import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConversationsAPI, createConversationAPI } from '../api/conversationAPI';
import ChatWindow from '../components/ChatWindow';
import useAuth from '../hooks/useAuth';
import './styles/ChatPage.css';
import CreateGroupModal from '../components/CreateGroupModal';
import Avatar from '../components/Avatar'; // Lấy Avatar mình đã làm ở bước trước

function ChatPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [showMenu, setShowMenu] = useState(false);
    const [showCreateGroup, setShowCreateGroup] = useState(false);

    // --- STATE MỚI CHO TÌM KIẾM ---
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        loadConversations();
    }, []);

    const loadConversations = async () => {
        setLoading(true);
        try {
            const data = await getConversationsAPI();
            setConversations(data.conversations);
            if (data.conversations.length > 0) {
                setSelectedConversation(data.conversations[0]);
            }
        } catch (err) {
            setError('Không thể tải danh sách cuộc trò chuyện');
        } finally {
            setLoading(false);
        }
    };

    const getConversationName = (conv) => {
        if (conv.type === 'group') return conv.name;
        const otherUser = conv.members.find((member) => member._id !== user._id);
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
        setShowCreateGroup(false);
    };

    const handleLogout = () => {
        if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
            localStorage.removeItem('token'); // Hoặc accessToken
            if (logout) logout();
            navigate('/login');
        }
    };

    // --- HÀM XỬ LÝ TÌM KIẾM NGAY TRÊN SIDEBAR ---
    const handleSearchInput = async (e) => {
        const value = e.target.value;
        setSearchTerm(value);

        if (!value.trim()) {
            setIsSearching(false);
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // Gọi backend tìm kiếm
            const data = await searchUsersAPI(value);
            setSearchResults(data.users || data || []);
        } catch (error) {
            console.error("Lỗi tìm kiếm:", error);
        }
    };

    // --- HÀM KHI CLICK VÀO NGƯỜI TÌM THẤY ---
    const handleSelectSearchedUser = async (userId) => {
        try {
            const res = await createConversationAPI({
                type: 'private',
                members: [userId]
            });
            if (res && res.conversation) {
                handleNewConversation(res.conversation);
                // Trả UI về trạng thái bình thường (tắt tìm kiếm)
                setSearchTerm('');
                setIsSearching(false);
                setSearchResults([]);
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Lỗi tạo cuộc trò chuyện');
        }
    };

    return (
        <div className="chat-page">
            {/* Sidebar: Danh sách conversation */}
            <aside className="chat-sidebar">
                
                {/* 1. HEADER SIDEBAR */}
                <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar name={user?.username} size={40} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h2 style={{ margin: 0, fontSize: '18px' }}>Tin nhắn</h2>
                            <span style={{ fontSize: '12px', color: '#666' }}>{user?.username}</span>
                        </div>
                    </div>

                    <div className='new-chat-container' style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-new-chat" title="Tạo nhóm mới" onClick={() => setShowMenu(!showMenu)}>
                            ➕
                        </button>
                        <button title="Đăng xuất" onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                            🚪
                        </button>

                        {showMenu && (
                            <div className="new-chat-menu">
                                <button onClick={() => { setShowCreateGroup(true); setShowMenu(false); }}>
                                    👥 Tạo nhóm mới
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. THANH TÌM KIẾM NẰM NGAY DƯỚI HEADER */}
                <div className="sidebar-search-container" style={{ padding: '10px 15px', borderBottom: '1px solid #e0e0e0' }}>
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm người dùng..." 
                        value={searchTerm}
                        onChange={handleSearchInput}
                        style={{ 
                            width: '100%', padding: '10px 15px', borderRadius: '20px', 
                            border: '1px solid #ccc', outline: 'none', backgroundColor: '#f0f2f5', boxSizing: 'border-box' 
                        }}
                    />
                </div>

                {/* 3. HIỂN THỊ KẾT QUẢ TÌM KIẾM HOẶC DANH SÁCH CHAT */}
                {loading && <div className="sidebar-loading">Đang tải...</div>}
                {error && <div className="sidebar-error">{error}</div>}

                {/* Nếu đang gõ tìm kiếm thì hiện list này */}
                {isSearching ? (
                    <ul className="conversation-list" style={{ flex: 1, overflowY: 'auto' }}>
                        {searchResults.length > 0 ? (
                            searchResults.map((searchUser) => (
                                <li 
                                    key={searchUser._id} 
                                    className="conversation-item"
                                    onClick={() => handleSelectSearchedUser(searchUser._id)}
                                >
                                    <Avatar name={searchUser.username} size={45} />
                                    <div className="conv-info" style={{ marginLeft: '15px' }}>
                                        <div className="conv-name">{searchUser.username}</div>
                                        <div className="conv-members" style={{ color: '#0084ff' }}>Nhấn để nhắn tin</div>
                                    </div>
                                </li>
                            ))
                        ) : (
                            <div className="sidebar-empty">Không tìm thấy người dùng "{searchTerm}"</div>
                        )}
                    </ul>
                ) : (
                    // Nếu không gõ gì thì hiện danh sách chat bình thường như cũ
                    <ul className="conversation-list">
                        {conversations.length === 0 && !loading && (
                            <div className="sidebar-empty">Chưa có cuộc trò chuyện nào.</div>
                        )}
                        {conversations.map((conv) => (
                            <li
                                key={conv._id}
                                className={`conversation-item ${selectedConversation?._id === conv._id ? 'active' : ''}`}
                                onClick={() => setSelectedConversation(conv)}
                            >
                                <Avatar name={getConversationName(conv)} size={45} />
                                <div className="conv-info" style={{ marginLeft: '15px' }}>
                                    <div className="conv-name">{getConversationName(conv)}</div>
                                    {conv.type === 'group' && (
                                        <div className="conv-members">{conv.members.length} thành viên</div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </aside>
            
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