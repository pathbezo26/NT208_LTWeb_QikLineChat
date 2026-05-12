import { useEffect, useState } from 'react';
import { getConversationsAPI, deleteConversationAPI } from '../api/conversationAPI';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import UserSearch from './UserSearch';
import CreateGroupModal from './CreateGroupModal';
import { formatMessageTime } from '../utils/formatTime';
import styles from './styles/Sidebar.module.css';

export default function Sidebar({ activeConversation, onSelectConversation }) {
    const { user, logout } = useAuth();
    const socket = useSocket();

    const [conversations, setConversations] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null);
            setDeleteConfirmId(null);
        };

        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const loadConversations = async () => {
        try {
            const data = await getConversationsAPI();
            setConversations(data);
        } catch (error) {
            console.error('Lỗi khi tải danh sách cuộc trò chuyện:', error);
        }
    };

    useEffect(() => {
        loadConversations();
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = () => {
            loadConversations();
        };

        socket.on('newMessage', handleNewMessage);

        return () => socket.off('newMessage', handleNewMessage);
    }, [socket]);

    const getConversationName = (conversation) => {
        if (conversation.type === 'group') {
            return conversation.name || 'Nhóm không tên';
        }

        const otherMember = conversation.members.find((member) => member._id !== user._id);
        return otherMember?.username || 'Người dùng';
    };

    const getAvatar = (conversation) => {
        if (conversation.type === 'group') return 'G';

        const displayName = getConversationName(conversation);
        return displayName.charAt(0).toUpperCase();
    };

    const toggleSearchPanel = () => {
        setShowSearch(!showSearch);
        setShowGroupModal(false);
    };

    const toggleGroupModal = () => {
        setShowGroupModal(!showGroupModal);
        setShowSearch(false);
    };

    const toggleMenu = (e, convId) => {
        e.stopPropagation();
        setOpenMenuId(openMenuId === convId ? null : convId);
        setDeleteConfirmId(null);
    };

    const handleDeleteConversation = async (e, convId) => {
        e.stopPropagation();
        setDeletingId(convId);

        try {
            await deleteConversationAPI(convId);
            setConversations((prev) => prev.filter((conv) => conv._id !== convId));

            if (activeConversation?._id === convId) {
                onSelectConversation(null);
            }

            setOpenMenuId(null);
            setDeleteConfirmId(null);
        } catch (error) {
            console.error('Lỗi khi xóa cuộc trò chuyện:', error);
            alert(error.response?.data?.message || 'Không thể xóa đoạn chat, vui lòng thử lại!');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.header}>
                <div className={styles.userInfo}>
                    <div className={styles.avatar}>
                        {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.username}>{user.username}</span>
                </div>

                <button className={styles.logoutBtn} onClick={logout} title="Đăng xuất">
                    ⎋
                </button>
            </div>

            <div className={styles.actions}>
                <button
                    className={`${styles.actionBtn} ${showSearch ? styles.actionActive : ''}`}
                    onClick={toggleSearchPanel}
                >
                    🔍 Tìm người dùng
                </button>
                <button
                    className={`${styles.actionBtn} ${showGroupModal ? styles.actionActive : ''}`}
                    onClick={toggleGroupModal}
                >
                    ➕ Tạo nhóm
                </button>
            </div>

            {showSearch && (
                <UserSearch
                    onConversationCreated={(newConversation) => {
                        setConversations((prev) => {
                            const isExist = prev.find((conv) => conv._id === newConversation._id);
                            if (isExist) return prev;

                            return [newConversation, ...prev];
                        });

                        onSelectConversation(newConversation);
                        setShowSearch(false);
                    }}
                />
            )}

            {showGroupModal && (
                <CreateGroupModal
                    onClose={() => setShowGroupModal(false)}
                    onCreated={(newGroup) => {
                        setConversations((prev) => [newGroup, ...prev]);
                        onSelectConversation(newGroup);
                        setShowGroupModal(false);
                    }}
                />
            )}

            <div className={styles.list}>
                {conversations.length === 0 && (
                    <p className={styles.empty}>Chưa có cuộc trò chuyện nào.</p>
                )}

                {conversations.map((conv) => {
                    const isCurrentlyActive = activeConversation?._id === conv._id;

                    return (
                        <div
                            key={conv._id}
                            className={`${styles.item} ${isCurrentlyActive ? styles.active : ''}`}
                            onClick={() => onSelectConversation(conv)}
                        >
                            <div className={styles.convAvatar}>
                                {getAvatar(conv)}
                            </div>

                            <div className={styles.convInfo}>
                                <span className={styles.convName}>
                                    {getConversationName(conv)}
                                </span>

                                <span className={styles.convTime}>
                                    {conv.updatedAt ? formatMessageTime(conv.updatedAt) : ''}
                                </span>
                            </div>

                            <div className={styles.optionsWrapper}>
                                <button
                                    className={styles.threeDotsBtn}
                                    onClick={(e) => toggleMenu(e, conv._id)}
                                >
                                    ⋮
                                </button>

                                {openMenuId === conv._id && (
                                    <div
                                        className={styles.dropdownMenu}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {deleteConfirmId === conv._id ? (
                                            <>
                                                <p className={styles.confirmText}>
                                                    Xóa cuộc trò chuyện này?
                                                </p>
                                                <div className={styles.confirmActions}>
                                                    <button
                                                        className={styles.cancelDeleteBtn}
                                                        onClick={() => setDeleteConfirmId(null)}
                                                        disabled={deletingId === conv._id}
                                                    >
                                                        Hủy
                                                    </button>
                                                    <button
                                                        className={styles.confirmDeleteBtn}
                                                        onClick={(e) => handleDeleteConversation(e, conv._id)}
                                                        disabled={deletingId === conv._id}
                                                    >
                                                        {deletingId === conv._id ? 'Đang xóa...' : 'Xóa'}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => setDeleteConfirmId(conv._id)}
                                            >
                                                Xóa hội thoại
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}