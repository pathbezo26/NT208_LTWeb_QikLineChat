import { useEffect, useState } from 'react';
import { UsergroupAddOutlined } from '@ant-design/icons';
import axiosInstance from '../api/axiosInstance';
import {
    createConversationAPI,
    deleteConversationAPI,
    getConversationsAPI,
} from '../api/conversationAPI';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import CreateGroupModal from './CreateGroupModal';
import SidebarSearch from './SidebarSearch';
import UserAvatar from './UserAvatar';
import { formatMessageTime } from '../utils/formatTime';
import styles from './styles/Sidebar.module.css';

const sectionTitles = {
    messages: 'Tin nhắn',
    contacts: 'Danh bạ',
    groups: 'Nhóm',
    settings: 'Cài đặt',
};

export default function Sidebar({ activeSection, activeConversation, onSelectConversation }) {
    const { user } = useAuth();
    const socket = useSocket();

    const [conversations, setConversations] = useState([]);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [creatingUserId, setCreatingUserId] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

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
        const handleClickOutside = () => {
            setOpenMenuId(null);
            setDeleteConfirmId(null);
        };

        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
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

    const getOtherMember = (conversation) => {
        return conversation.members.find((member) => member._id !== user._id);
    };

    const handleConversationCreated = (newConversation) => {
        setConversations((prev) => {
            const isExist = prev.find((conv) => conv._id === newConversation._id);
            if (isExist) return prev;

            return [newConversation, ...prev];
        });

        onSelectConversation(newConversation);
    };

    const handleSearchUsers = async (e) => {
        const value = e.target.value;
        setSearchQuery(value);

        if (!value.trim()) {
            setSearchResults([]);
            setSearchLoading(false);
            return;
        }

        setSearchLoading(true);

        try {
            const res = await axiosInstance.get(`/users/search?q=${encodeURIComponent(value)}`);
            setSearchResults(res.data.filter((searchUser) => searchUser._id !== user._id));
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleStartChat = async (targetUser) => {
        setCreatingUserId(targetUser._id);

        try {
            const newConversation = await createConversationAPI({
                type: 'private',
                members: [targetUser._id],
            });

            handleConversationCreated(newConversation);
            setSearchQuery('');
            setSearchResults([]);
        } catch (error) {
            alert(error.response?.data?.message || 'Không thể tạo cuộc trò chuyện');
        } finally {
            setCreatingUserId(null);
        }
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

    const toggleMenu = (e, convId) => {
        e.stopPropagation();
        setOpenMenuId(openMenuId === convId ? null : convId);
        setDeleteConfirmId(null);
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.header}>
                <h2 className={styles.title}>
                    {sectionTitles[activeSection] || sectionTitles.messages}
                </h2>
            </div>

            <div className={styles.actions}>
                <SidebarSearch
                    value={searchQuery}
                    onChange={handleSearchUsers}
                />

                <button
                    className={`${styles.createGroupBtn} ${showGroupModal ? styles.createGroupActive : ''}`}
                    onClick={() => setShowGroupModal((current) => !current)}
                    title="Tạo nhóm"
                    aria-label="Tạo nhóm"
                    type="button"
                >
                    <UsergroupAddOutlined />
                </button>
            </div>

            {showGroupModal && (
                <CreateGroupModal
                    onClose={() => setShowGroupModal(false)}
                    onCreated={(newGroup) => {
                        handleConversationCreated(newGroup);
                        setShowGroupModal(false);
                    }}
                />
            )}

            <div className={styles.list}>
                {searchQuery.trim() ? (
                    <>
                        {searchLoading && <p className={styles.empty}>Đang tìm...</p>}

                        {!searchLoading && searchResults.length === 0 && (
                            <p className={styles.empty}>Không tìm thấy kết quả nào.</p>
                        )}

                        {!searchLoading && searchResults.map((searchUser) => (
                            <button
                                key={searchUser._id}
                                type="button"
                                className={styles.searchItem}
                                onClick={() => handleStartChat(searchUser)}
                                disabled={creatingUserId === searchUser._id}
                            >
                                <UserAvatar
                                    user={searchUser}
                                    className={styles.convAvatar}
                                />
                                <span className={styles.searchName}>{searchUser.username}</span>
                                <span className={styles.searchAction}>
                                    {creatingUserId === searchUser._id ? '...' : 'Chat'}
                                </span>
                            </button>
                        ))}
                    </>
                ) : conversations.length === 0 ? (
                    <p className={styles.empty}>Chưa có cuộc trò chuyện nào.</p>
                ) : conversations.map((conv) => {
                    const isCurrentlyActive = activeConversation?._id === conv._id;
                    const otherMember = conv.type === 'private' ? getOtherMember(conv) : null;

                    return (
                        <div
                            key={conv._id}
                            className={`${styles.item} ${isCurrentlyActive ? styles.active : ''}`}
                            onClick={() => onSelectConversation(conv)}
                        >
                            <UserAvatar
                                user={otherMember}
                                name={conv.type === 'group' ? (conv.name || 'Nhóm') : otherMember?.username}
                                className={styles.convAvatar}
                                fallback={conv.type === 'group' ? 'G' : '?'}
                            />

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
                                    type="button"
                                    aria-label="Tùy chọn hội thoại"
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
                                                        type="button"
                                                    >
                                                        Hủy
                                                    </button>
                                                    <button
                                                        className={styles.confirmDeleteBtn}
                                                        onClick={(e) => handleDeleteConversation(e, conv._id)}
                                                        disabled={deletingId === conv._id}
                                                        type="button"
                                                    >
                                                        {deletingId === conv._id ? 'Đang xóa...' : 'Xóa'}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => setDeleteConfirmId(conv._id)}
                                                type="button"
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
