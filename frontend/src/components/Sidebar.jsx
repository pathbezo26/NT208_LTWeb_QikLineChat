import { useEffect, useState } from 'react';
import { TeamOutlined, UsergroupAddOutlined } from '@ant-design/icons';
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
    const [unreadConversationIds, setUnreadConversationIds] = useState(new Set());
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
        if (!activeConversation) return;

        setUnreadConversationIds((prev) => {
            const next = new Set(prev);
            next.delete(activeConversation._id);
            return next;
        });
    }, [activeConversation]);

    useEffect(() => {
        if (!socket || !user) return;

        const handleConversationUpdated = async ({ conversationId, senderId }) => {

            try {
                const freshConversations = await getConversationsAPI();

                setConversations(() => {
                    const updatedConversation = freshConversations.find(
                        (conversation) => conversation._id === conversationId
                    );

                    if (!updatedConversation) return freshConversations;

                    const otherConversations = freshConversations.filter(
                        (conversation) => conversation._id !== conversationId
                    );

                    return [updatedConversation, ...otherConversations];
                });
            } catch (error) {
                console.error('Sidebar update error:', error);
            }

            const isMyMessage = senderId === user._id;
            const isActiveConversation = activeConversation?._id === conversationId;

            if (!isMyMessage && !isActiveConversation) {
                setUnreadConversationIds((prev) => {
                    const next = new Set(prev);
                    next.add(conversationId);
                    return next;
                });
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

    const handleConversationCreated = (newConversation) => {
        setConversations((prev) => {
            const isExist = prev.find((conv) => conv._id === newConversation._id);
            if (isExist) return prev;

            return [newConversation, ...prev];
        });

        onSelectConversation(newConversation);
    };

    const handleSelectConversation = (conversation) => {
        setUnreadConversationIds((prev) => {
            const next = new Set(prev);
            next.delete(conversation._id);
            return next;
        });

        onSelectConversation(conversation);
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
            setUnreadConversationIds((prev) => {
                const next = new Set(prev);
                next.delete(convId);
                return next;
            });

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
                    const hasUnread = unreadConversationIds.has(conv._id);
                    const otherMember = conv.type === 'private' ? getOtherMember(conv) : null;

                    return (
                        <div
                            key={conv._id}
                            className={`${styles.item} ${isCurrentlyActive ? styles.active : ''} ${hasUnread ? styles.unread : ''}`}
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

                            {hasUnread && <span className={styles.unreadDot} />}

                            <div className={styles.optionsWrapper}>
                                <button
                                    className={styles.threeDotsBtn}
                                    onClick={(e) => toggleMenu(e, conv._id)}
                                    type="button"
                                    aria-label="Conversation options"
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
