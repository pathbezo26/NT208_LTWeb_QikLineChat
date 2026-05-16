import { useEffect, useRef, useState } from 'react';
import { TeamOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { Badge, message as antdMessage } from 'antd';
import axiosInstance from '../api/axiosInstance';
import {
    createConversationAPI,
    deleteConversationAPI,
    getConversationAPI,
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

const SEARCH_DEBOUNCE_MS = 300;

const sortConversationsByUpdatedAt = (items) => {
    return [...items].sort((first, second) => {
        return new Date(second.updatedAt || 0).getTime() - new Date(first.updatedAt || 0).getTime();
    });
};

export default function Sidebar({
    activeSection,
    activeConversation,
    onSelectConversation,
    optimisticConversationUpdate,
}) {
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
    const [messageApi, contextHolder] = antdMessage.useMessage();
    const conversationUpdateRequestRef = useRef({});

    const activeConversationId = activeConversation?._id;

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
        const keyword = searchQuery.trim();

        if (!keyword) {
            setSearchResults([]);
            setSearchLoading(false);
            return undefined;
        }

        let ignore = false;
        const debounceTimer = setTimeout(async () => {
            setSearchLoading(true);

            try {
                const res = await axiosInstance.get(`/users/search?q=${encodeURIComponent(keyword)}`);

                if (!ignore) {
                    setSearchResults(res.data.filter((searchUser) => searchUser._id !== user._id));
                }
            } catch (error) {
                console.error('Search error:', error);
                if (!ignore) {
                    setSearchResults([]);
                    messageApi.error('Could not search users.');
                }
            } finally {
                if (!ignore) setSearchLoading(false);
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            ignore = true;
            clearTimeout(debounceTimer);
        };
    }, [messageApi, searchQuery, user._id]);

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

        const handleConversationUpdated = async ({
            conversationId,
            unreadCount,
            updatedAt,
            lastMessage,
        }) => {
            const requestNumber = (conversationUpdateRequestRef.current[conversationId] || 0) + 1;
            conversationUpdateRequestRef.current[conversationId] = requestNumber;

            try {
                const isActiveConversation = activeConversationId === conversationId;

                let shouldFetchConversation = false;

                setConversations((prev) => {
                    const targetConversation = prev.find((conversation) => conversation._id === conversationId);
                    if (!targetConversation) {
                        shouldFetchConversation = true;
                        return prev;
                    }

                    const patchedConversation = {
                        ...targetConversation,
                        updatedAt: updatedAt || targetConversation.updatedAt,
                        unreadCount: isActiveConversation ? 0 : unreadCount ?? targetConversation.unreadCount ?? 0,
                        lastMessage: lastMessage || targetConversation.lastMessage,
                    };
                    const otherConversations = prev.filter((conversation) => conversation._id !== conversationId);

                    return sortConversationsByUpdatedAt([patchedConversation, ...otherConversations]);
                });

                if (isActiveConversation) {
                    await markConversationReadAPI(conversationId);
                }

                if (!shouldFetchConversation && lastMessage) {
                    return;
                }

                const updatedConversation = await getConversationAPI(conversationId);
                if (conversationUpdateRequestRef.current[conversationId] !== requestNumber) return;

                const normalizedConversation = isActiveConversation
                    ? { ...updatedConversation, unreadCount: 0 }
                    : updatedConversation;

                setConversations((prev) => {
                    const otherConversations = prev.filter((conversation) => conversation._id !== conversationId);
                    return sortConversationsByUpdatedAt([normalizedConversation, ...otherConversations]);
                });

                if (isActiveConversation) {
                    onSelectConversation(normalizedConversation);
                }
            } catch (error) {
                console.error('Sidebar update error:', error);

                if (error.response?.status === 404) {
                    setConversations((prev) => prev.filter((conversation) => conversation._id !== conversationId));
                }
            }
        };

        socket.on('conversationUpdated', handleConversationUpdated);

        return () => socket.off('conversationUpdated', handleConversationUpdated);
    }, [socket, user, activeConversationId, onSelectConversation]);

    useEffect(() => {
        if (!optimisticConversationUpdate?.conversationId) return;

        const {
            conversationId,
            clientMessageId,
            content,
            createdAt,
            sender,
        } = optimisticConversationUpdate;

        setConversations((prev) => {
            const targetConversation = prev.find((conversation) => conversation._id === conversationId);
            if (!targetConversation) return prev;

            const updatedConversation = {
                ...targetConversation,
                updatedAt: createdAt,
                unreadCount: 0,
                lastMessage: {
                    messageId: clientMessageId,
                    sender,
                    content,
                    createdAt,
                },
            };
            const otherConversations = prev.filter((conversation) => conversation._id !== conversationId);

            return [updatedConversation, ...otherConversations];
        });
    }, [optimisticConversationUpdate]);

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

    const handleSearchUsers = (e) => {
        setSearchQuery(e.target.value);
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
            messageApi.error(error.response?.data?.message || 'Could not create conversation');
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
            messageApi.error(error.response?.data?.message || 'Could not delete chat. Please try again!');
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
        <>
        {contextHolder}
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
                    <div className={styles.skeletonList} aria-label="Loading conversations">
                        {[0, 1, 2, 3, 4].map((item) => (
                            <div className={styles.skeletonItem} key={item}>
                                <span className={styles.skeletonAvatar} />
                                <span className={styles.skeletonContent}>
                                    <span className={styles.skeletonLine} />
                                    <span className={styles.skeletonLineShort} />
                                </span>
                            </div>
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                            <TeamOutlined />
                        </div>
                        <p>No conversations yet</p>
                        <span>Search for someone or create a group to start chatting.</span>
                    </div>
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
        </>
    );
}
