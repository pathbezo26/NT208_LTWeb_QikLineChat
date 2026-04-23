<<<<<<< HEAD
import { useState, useEffect, useRef } from 'react';
import useAuth from '../hooks/useAuth';
import { getMessagesAPI, sendMessageAPI } from '../api/messageAPI';
import {
    getConversationsAPI,
    createConversationAPI,
    searchUsersAPI
} from '../api/chatAPI';

function ChatPage() {
    const { user, logout } = useAuth();

    // ─── State ─────────────────────────────────────────────────────────────────
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchUsername, setSearchUsername] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const messagesEndRef = useRef(null);

    // ─── Load conversations on startup ─────────────────────────────────────────
=======
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
>>>>>>> 47c3c964ea039ce056e956fba4034d283a94b97b
    useEffect(() => {
        loadConversations();
    }, []);

<<<<<<< HEAD
    // ─── Auto scroll to bottom when messages change ────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ─── Load messages when active conversation changes ────────────────────────
    useEffect(() => {
        if (activeConversation) {
            loadMessages(activeConversation._id);
        }
    }, [activeConversation]);

    // ─── Functions ─────────────────────────────────────────────────────────────

    const loadConversations = async () => {
        try {
            const data = await getConversationsAPI();
            setConversations(data.conversations);
        } catch (err) {
            setError('Không thể tải danh sách cuộc trò chuyện');
        }
    };

    const loadMessages = async (conversationId) => {
        try {
            setLoading(true);
            const data = await getMessagesAPI(conversationId);
            setMessages(data.messages);
        } catch (err) {
            setError('Không thể tải tin nhắn');
=======
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
>>>>>>> 47c3c964ea039ce056e956fba4034d283a94b97b
        } finally {
            setLoading(false);
        }
    };

<<<<<<< HEAD
    const handleSendMessage = async () => {
        if (!newMessage.trim() || !activeConversation) return;
        try {
            const data = await sendMessageAPI(activeConversation._id, newMessage);
            // Add new message to the list immediately without refetching
            setMessages(prev => [...prev, data.message]);
            setNewMessage('');
            // Bubble conversation to top of sidebar
            loadConversations();
        } catch (err) {
            setError('Không thể gửi tin nhắn');
        }
    };

    const handleSearch = async () => {
        if (!searchUsername.trim()) return;
        try {
            const data = await searchUsersAPI(searchUsername);
            setSearchResults(data.users);
        } catch (err) {
            setError('Không thể tìm kiếm người dùng');
        }
    };

    const handleStartConversation = async (targetUserId) => {
        try {
            const data = await createConversationAPI(targetUserId);
            setActiveConversation(data.conversation);
            setSearchResults([]);
            setSearchUsername('');
            loadConversations();
        } catch (err) {
            setError('Không thể tạo cuộc trò chuyện');
        }
    };

    // Helper — get the other person's name in a private chat
    const getConversationName = (conversation) => {
        const other = conversation.members.find(
            member => member._id !== user._id
        );
        return other?.username || 'Unknown';
    };

    // Send message when Enter is pressed
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSendMessage();
    };

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', height: '100vh' }}>

            {/* ── LEFT SIDEBAR ── */}
            <div style={{ width: '300px', borderRight: '1px solid #ccc', padding: '10px' }}>

                {/* User info + logout */}
                <div style={{ marginBottom: '10px' }}>
                    <strong>{user?.username}</strong>
                    <button onClick={logout} style={{ marginLeft: '10px' }}>
                        Đăng xuất
                    </button>
                </div>

                {/* Search box */}
                <div style={{ marginBottom: '10px' }}>
                    <input
                        type="text"
                        placeholder="Tìm username..."
                        value={searchUsername}
                        onChange={(e) => setSearchUsername(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button onClick={handleSearch}>Tìm</button>
                </div>

                {/* Search results */}
                {searchResults.map(u => (
                    <div
                        key={u._id}
                        onClick={() => handleStartConversation(u._id)}
                        style={{ cursor: 'pointer', padding: '5px', background: '#f0f0f0', marginBottom: '4px' }}
                    >
                        {u.username}
                    </div>
                ))}

                {/* Conversation list */}
                <div>
                    {conversations.map(conv => (
                        <div
                            key={conv._id}
                            onClick={() => setActiveConversation(conv)}
                            style={{
                                cursor: 'pointer',
                                padding: '8px',
                                marginBottom: '4px',
                                background: activeConversation?._id === conv._id ? '#d0e8ff' : '#f9f9f9'
                            }}
                        >
                            {getConversationName(conv)}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── RIGHT CHAT AREA ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px' }}>

                {error && <div style={{ color: 'red' }}>{error}</div>}

                {!activeConversation ? (
                    <div style={{ margin: 'auto' }}>Chọn một cuộc trò chuyện để bắt đầu</div>
                ) : (
                    <>
                        {/* Conversation header */}
                        <div style={{ borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '8px' }}>
                            <strong>{getConversationName(activeConversation)}</strong>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {loading && <div>Đang tải tin nhắn...</div>}
                            {messages.map(msg => (
                                <div
                                    key={msg._id}
                                    style={{
                                        marginBottom: '8px',
                                        textAlign: msg.sender._id === user._id ? 'right' : 'left'
                                    }}
                                >
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '6px 10px',
                                        borderRadius: '12px',
                                        background: msg.sender._id === user._id ? '#0084ff' : '#e4e6eb',
                                        color: msg.sender._id === user._id ? 'white' : 'black'
                                    }}>
                                        {msg.content}
                                    </span>
                                    <div style={{ fontSize: '11px', color: '#999' }}>
                                        {msg.sender.username}
                                    </div>
                                </div>
                            ))}
                            {/* Invisible div at bottom for auto scroll */}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message input */}
                        <div style={{ display: 'flex', marginTop: '10px' }}>
                            <input
                                type="text"
                                placeholder="Nhập tin nhắn..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                style={{ flex: 1, padding: '8px' }}
                            />
                            <button onClick={handleSendMessage} style={{ padding: '8px 16px' }}>
                                Gửi
                            </button>
                        </div>
                    </>
                )}
            </div>
=======
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
>>>>>>> 47c3c964ea039ce056e956fba4034d283a94b97b
        </div>
    );
}

<<<<<<< HEAD
export default ChatPage;
=======
export default ChatPage;
>>>>>>> 47c3c964ea039ce056e956fba4034d283a94b97b
