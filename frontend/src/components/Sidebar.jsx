import { useEffect, useState } from 'react';
import { TeamOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { Badge } from 'antd';
import axiosInstance from '../api/axiosInstance';
import {
    createConversationAPI,
    deleteConversationAPI,
    getConversationsAPI,
    markConversationReadAPI,
} from '../api/conversationAPI';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import CreateGroupModal from './CreateGroupModal';
import SidebarSearch from './SidebarSearch';
import UserAvatar from './UserAvatar';
import { formatMessageTime } from '../utils/formatTime';
import styles from './styles/Sidebar.module.css';

const sectionTitles = {
    messages: 'Messages',
    contacts: 'Contacts',
    groups: 'Groups',
    settings: 'Settings',
};

export default function Sidebar({ activeSection, activeConversation, onSelectConversation }) {
    const { user } = useAuth();
    const socket = useSocket();

    const [conversations, setConversations] = useState([]);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [creatingUserId, setCreatingUserId] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const loadConversations = async () => {
        setIsLoadingConversations(true);
        try {
            const data = await getConversationsAPI();
            setConversations(data);
        } catch (error) {
            console.error('Lỗi khi tải danh sách cuộc trò chuyện:', error);
        } finally {
            setIsLoadingConversations(false);
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
        if (!socket || !user) return;

        const handleConversationUpdated = async ({ conversationId }) => {

            try {
                const freshConversations = await getConversationsAPI();
                const isActiveConversation = activeConversation?._id === conversationId;

                if (isActiveConversation) {
                    await markConversationReadAPI(conversationId);
                }

                setConversations(() => {
                    const updatedConversation = freshConversations.find(
                        (conversation) => conversation._id === conversationId
                    );

                    if (!updatedConversation) return freshConversations;

                    if (isActiveConversation) {
                        updatedConversation.unreadCount = 0;
                    }

                    const otherConversations = freshConversations.filter(
                        (conversation) => conversation._id !== conversationId
                    );

                    return [updatedConversation, ...otherConversations];
                });
            } catch (error) {
                console.error('Sidebar update error:', error);
            }
        };

        socket.on('conversationUpdated', handleConversationUpdated);

        return () => socket.off('conversationUpdated', handleConversationUpdated);
    }, [socket, user, activeConversation]);

    const getConversationName = (conversation) => {
        if (conversation.type === 'group') {
            return conversation.name || 'Unnamed group';
        }

        const otherMember = conversation.members.find((member) => member._id !== user._id);
        return otherMember?.username || 'User';
    };

    const getOtherMember = (conversation) => {
        return conversation.members.find((member) => member._id !== user._id);
    };

    const getLastMessagePreview = (conversation) => {
        if (!conversation.lastMessage?.content) return 'No messages yet';

        const senderId = conversation.lastMessage.sender?._id || conversation.lastMessage.sender;
        const senderName = conversation.lastMessage.sender?.username || 'User';

        if (senderId === user._id) {
            return `You: ${conversation.lastMessage.content}`;
        }

        if (conversation.type === 'group') {
            return `${senderName}: ${conversation.lastMessage.content}`;
        }

        return conversation.lastMessage.content;
    };

    const handleConversationCreated = (newConversation) => {
        setConversations((prev) => {
            const isExist = prev.find((conv) => conv._id === newConversation._id);
            if (isExist) return prev;

            return [newConversation, ...prev];
        });

        onSelectConversation(newConversation);
    };

    const handleSelectConversation = async (conversation) => {
        onSelectConversation(conversation);

        if (conversation.unreadCount > 0) {
            try {
                await markConversationReadAPI(conversation._id);

                setConversations((prev) => prev.map((conv) => {
                    if (conv._id !== conversation._id) return conv;
                    return { ...conv, unreadCount: 0 };
                }));
            } catch (error) {
                console.error('Mark conversation read error:', error);
            }
        }
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
            alert(error.response?.data?.message || 'Could not create conversation');
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
            alert(error.response?.data?.message || 'Could not delete chat. Please try again!');
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
                    title="Create group"
                    aria-label="Create group"
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
                        {searchLoading && <p className={styles.empty}>Searching...</p>}

                        {!searchLoading && searchResults.length === 0 && (
                            <p className={styles.empty}>No results found.</p>
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
                ) : isLoadingConversations ? (
                    <p className={styles.empty}>Loading conversations...</p>
                ) : conversations.length === 0 ? (
                    <p className={styles.empty}>No conversations yet.</p>
                ) : conversations.map((conv) => {
                    const isCurrentlyActive = activeConversation?._id === conv._id;
                    const unreadCount = conv.unreadCount || 0;
                    const hasUnread = unreadCount > 0;
                    const otherMember = conv.type === 'private' ? getOtherMember(conv) : null;
                    const isMenuOpen = openMenuId === conv._id;

                    return (
                        <div
                            key={conv._id}
                            className={`${styles.item} ${isCurrentlyActive ? styles.active : ''} ${hasUnread ? styles.unread : ''} ${isMenuOpen ? styles.menuOpen : ''}`}
                            onClick={() => handleSelectConversation(conv)}
                        >
                            <UserAvatar
                                user={otherMember}
                                name={conv.type === 'group' ? (conv.name || 'Group') : otherMember?.username}
                                src={conv.type === 'group' ? conv.avatar?.url : undefined}
                                className={`${styles.convAvatar} ${conv.type === 'group' ? styles.groupAvatar : ''}`}
                                fallback={conv.type === 'group' ? 'G' : '?'}
                            />

                            <div className={styles.convInfo}>
                                <div className={styles.convHeader}>
                                    <span className={styles.convName}>
                                        {conv.type === 'group' && (
                                            <TeamOutlined className={styles.groupNameIcon} />
                                        )}
                                        <span className={styles.convNameText}>
                                            {getConversationName(conv)}
                                        </span>
                                    </span>

                                    <span className={styles.convTime}>
                                        {conv.updatedAt ? formatMessageTime(conv.updatedAt) : ''}
                                    </span>
                                </div>

                                <div className={styles.convPreview}>
                                    <span className={styles.lastMessage}>
                                        {getLastMessagePreview(conv)}
                                    </span>

                                    <Badge
                                        count={unreadCount}
                                        overflowCount={99}
                                        size="small"
                                        className={styles.unreadBadge}
                                    />
                                </div>
                            </div>

                            <div className={styles.optionsWrapper}>
                                <button
                                    className={styles.threeDotsBtn}
                                    onClick={(e) => toggleMenu(e, conv._id)}
                                    type="button"
                                    aria-label="Conversation options"
                                >
                                    ⋮
                                </button>

                                {isMenuOpen && (
                                    <div
                                        className={styles.dropdownMenu}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {deleteConfirmId === conv._id ? (
                                            <>
                                                <p className={styles.confirmText}>
                                                    Delete this conversation?
                                                </p>
                                                <div className={styles.confirmActions}>
                                                    <button
                                                        className={styles.cancelDeleteBtn}
                                                        onClick={() => setDeleteConfirmId(null)}
                                                        disabled={deletingId === conv._id}
                                                        type="button"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        className={styles.confirmDeleteBtn}
                                                        onClick={(e) => handleDeleteConversation(e, conv._id)}
                                                        disabled={deletingId === conv._id}
                                                        type="button"
                                                    >
                                                        {deletingId === conv._id ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => setDeleteConfirmId(conv._id)}
                                                type="button"
                                            >
                                                Delete conversation
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
