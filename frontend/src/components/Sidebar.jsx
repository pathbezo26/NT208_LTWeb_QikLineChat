import { useCallback, useEffect, useRef, useState } from 'react';
import {
    CheckOutlined,
    CloseOutlined,
    ContactsOutlined,
    DeleteOutlined,
    MessageOutlined,
    TeamOutlined,
    UserAddOutlined,
    UsergroupAddOutlined,
} from '@ant-design/icons';
import { Badge, message as antdMessage } from 'antd';
import axiosInstance from '../api/axiosInstance';
import {
    createConversationAPI,
    deleteConversationAPI,
    getConversationAPI,
    getConversationsAPI,
    markConversationReadAPI,
} from '../api/conversationAPI';
import {
    acceptContactRequestAPI,
    cancelContactRequestAPI,
    declineContactRequestAPI,
    getContactsAPI,
    removeContactAPI,
    sendContactRequestAPI,
} from '../api/userAPI';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import CreateGroupModal from './CreateGroupModal';
import SidebarSearch from './SidebarSearch';
import UserAvatar from './UserAvatar';
import { formatRelativeTime } from '../utils/formatTime';
import styles from './styles/Sidebar.module.css';

const sectionTitles = {
    messages: 'Messages',
    contacts: 'Contacts',
    groups: 'Groups',
    settings: 'Settings',
};

const SEARCH_DEBOUNCE_MS = 300;
const CONVERSATION_PAGE_SIZE = 20;
const SIDEBAR_BOTTOM_THRESHOLD = 140;
const RELATIVE_TIME_REFRESH_MS = 60 * 1000;

const defaultContactsState = {
    contacts: [],
    incomingRequests: [],
    outgoingRequests: [],
};

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
    syncedConversationUpdate,
    removedConversation,
    onNavBadgesChange,
    onOpenConversation,
}) {
    const { user } = useAuth();
    const socket = useSocket();

    const [conversations, setConversations] = useState([]);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
    const [conversationNextCursor, setConversationNextCursor] = useState(null);
    const [hasMoreConversations, setHasMoreConversations] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [creatingUserId, setCreatingUserId] = useState(null);
    const [contactsState, setContactsState] = useState(defaultContactsState);
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);
    const [contactActionId, setContactActionId] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [, setRelativeTimeTick] = useState(0);
    const [messageApi, contextHolder] = antdMessage.useMessage();
    const conversationUpdateRequestRef = useRef({});
    const isLoadingMoreConversationsRef = useRef(false);
    const listRef = useRef(null);

    const activeConversationId = activeConversation?._id;
    const displayedConversations = activeSection === 'groups'
        ? conversations.filter((conversation) => conversation.type === 'group')
        : conversations;

    const loadConversations = async () => {
        setIsLoadingConversations(true);
        try {
            const data = await getConversationsAPI({
                paginated: true,
                limit: CONVERSATION_PAGE_SIZE,
            });

            setConversations(data.conversations || []);
            setHasMoreConversations(Boolean(data.hasMore));
            setConversationNextCursor(data.nextCursor || null);
        } catch (error) {
            console.error('Lỗi khi tải danh sách cuộc trò chuyện:', error);
        } finally {
            setIsLoadingConversations(false);
        }
    };

    const loadContacts = useCallback(async () => {
        setIsLoadingContacts(true);
        try {
            const data = await getContactsAPI();
            setContactsState({
                contacts: data.contacts || [],
                incomingRequests: data.incomingRequests || [],
                outgoingRequests: data.outgoingRequests || [],
            });
        } catch (error) {
            console.error('Load contacts error:', error);
            messageApi.error('Could not load contacts.');
        } finally {
            setIsLoadingContacts(false);
        }
    }, [messageApi]);

    const loadMoreConversations = async () => {
        if (
            !hasMoreConversations
            || !conversationNextCursor
            || isLoadingMoreConversationsRef.current
            || searchQuery.trim()
        ) return;

        isLoadingMoreConversationsRef.current = true;
        setIsLoadingMoreConversations(true);

        try {
            const data = await getConversationsAPI({
                paginated: true,
                limit: CONVERSATION_PAGE_SIZE,
                cursor: conversationNextCursor,
            });

            setConversations((prev) => {
                const existingIds = new Set(prev.map((conversation) => conversation._id));
                const nextItems = (data.conversations || []).filter((conversation) => {
                    return !existingIds.has(conversation._id);
                });

                return [...prev, ...nextItems];
            });
            setHasMoreConversations(Boolean(data.hasMore));
            setConversationNextCursor(data.nextCursor || null);
        } catch (error) {
            console.error('Load more conversations error:', error);
            messageApi.error('Could not load more conversations.');
        } finally {
            isLoadingMoreConversationsRef.current = false;
            setIsLoadingMoreConversations(false);
        }
    };

    const handleConversationListScroll = () => {
        const list = listRef.current;
        if (!list) return;

        const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
        if (distanceToBottom > SIDEBAR_BOTTOM_THRESHOLD) return;

        loadMoreConversations();
    };

    useEffect(() => {
        loadConversations();
    }, []);

    useEffect(() => {
        loadContacts();
    }, [loadContacts]);

    useEffect(() => {
        const timer = setInterval(() => {
            setRelativeTimeTick((tick) => tick + 1);
        }, RELATIVE_TIME_REFRESH_MS);

        return () => clearInterval(timer);
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
            conversation,
        }) => {
            const requestNumber = (conversationUpdateRequestRef.current[conversationId] || 0) + 1;
            conversationUpdateRequestRef.current[conversationId] = requestNumber;

            try {
                const isActiveConversation = activeConversationId === conversationId;

                if (conversation?._id) {
                    const normalizedConversation = {
                        ...conversation,
                        unreadCount: isActiveConversation ? 0 : unreadCount ?? conversation.unreadCount ?? 0,
                        lastMessage: lastMessage || conversation.lastMessage,
                        updatedAt: updatedAt || conversation.updatedAt,
                    };

                    setConversations((prev) => {
                        const otherConversations = prev.filter((item) => item._id !== conversationId);
                        return sortConversationsByUpdatedAt([normalizedConversation, ...otherConversations]);
                    });

                    if (isActiveConversation) {
                        await markConversationReadAPI(conversationId);
                        onSelectConversation({ ...normalizedConversation, unreadCount: 0 });
                    }

                    return;
                }

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

        const handleConversationRemoved = ({ conversationId }) => {
            setConversations((prev) => prev.filter((conversation) => conversation._id !== conversationId));

            if (activeConversationId === conversationId) {
                onSelectConversation(null);
            }
        };

        socket.on('conversationUpdated', handleConversationUpdated);
        socket.on('conversationRemoved', handleConversationRemoved);

        return () => {
            socket.off('conversationUpdated', handleConversationUpdated);
            socket.off('conversationRemoved', handleConversationRemoved);
        };
    }, [socket, user, activeConversationId, onSelectConversation]);

    useEffect(() => {
        if (!socket || !user) return;

        const refreshContacts = () => {
            loadContacts();
        };

        socket.on('contactRequestReceived', refreshContacts);
        socket.on('contactRequestAccepted', refreshContacts);
        socket.on('contactRequestDeclined', refreshContacts);
        socket.on('contactRequestCancelled', refreshContacts);
        socket.on('contactRemoved', refreshContacts);

        return () => {
            socket.off('contactRequestReceived', refreshContacts);
            socket.off('contactRequestAccepted', refreshContacts);
            socket.off('contactRequestDeclined', refreshContacts);
            socket.off('contactRequestCancelled', refreshContacts);
            socket.off('contactRemoved', refreshContacts);
        };
    }, [socket, user, loadContacts]);

    useEffect(() => {
        const unreadMessages = conversations.reduce((total, conversation) => {
            return total + Number(conversation.unreadCount || 0);
        }, 0);

        onNavBadgesChange?.({
            unreadMessages,
            incomingContacts: contactsState.incomingRequests.length,
        });
    }, [contactsState.incomingRequests.length, conversations, onNavBadgesChange]);

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

    useEffect(() => {
        if (!syncedConversationUpdate?.conversation?._id) return;

        setConversations((prev) => {
            const otherConversations = prev.filter((conversation) => {
                return conversation._id !== syncedConversationUpdate.conversation._id;
            });

            return sortConversationsByUpdatedAt([syncedConversationUpdate.conversation, ...otherConversations]);
        });
    }, [syncedConversationUpdate]);

    useEffect(() => {
        if (!removedConversation?.conversationId) return;

        setConversations((prev) => {
            return prev.filter((conversation) => conversation._id !== removedConversation.conversationId);
        });
        setOpenMenuId(null);
        setDeleteConfirmId(null);
    }, [removedConversation]);

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

    const getConversationDisplayTime = (conversation) => {
        return conversation.lastMessage?.createdAt || conversation.updatedAt;
    };

    const handleConversationCreated = (newConversation) => {
        setConversations((prev) => {
            const isExist = prev.find((conv) => conv._id === newConversation._id);
            if (isExist) return prev;

            return [newConversation, ...prev];
        });

        if (activeSection === 'contacts') {
            onOpenConversation?.(newConversation);
            return;
        }

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

    const handleSendContactRequest = async (targetUser) => {
        setContactActionId(targetUser._id);

        try {
            await sendContactRequestAPI(targetUser._id);
            messageApi.success('Contact request sent.');
            await loadContacts();
            setSearchResults((prev) => prev.map((item) => {
                if (item._id !== targetUser._id) return item;
                return { ...item, relationshipStatus: 'outgoing_pending' };
            }));
        } catch (error) {
            messageApi.error(error.response?.data?.message || 'Could not send contact request.');
        } finally {
            setContactActionId(null);
        }
    };

    const handleAcceptContactRequest = async (request) => {
        setContactActionId(request._id);

        try {
            await acceptContactRequestAPI(request._id);
            messageApi.success('Contact added.');
            await loadContacts();
        } catch (error) {
            messageApi.error(error.response?.data?.message || 'Could not accept request.');
        } finally {
            setContactActionId(null);
        }
    };

    const handleDeclineContactRequest = async (request) => {
        setContactActionId(request._id);

        try {
            await declineContactRequestAPI(request._id);
            await loadContacts();
        } catch (error) {
            messageApi.error(error.response?.data?.message || 'Could not decline request.');
        } finally {
            setContactActionId(null);
        }
    };

    const handleCancelContactRequest = async (request) => {
        setContactActionId(request._id);

        try {
            await cancelContactRequestAPI(request._id);
            await loadContacts();
            setSearchResults((prev) => prev.map((item) => {
                if (item._id !== request.otherUser?._id) return item;
                return { ...item, relationshipStatus: 'none' };
            }));
        } catch (error) {
            messageApi.error(error.response?.data?.message || 'Could not cancel request.');
        } finally {
            setContactActionId(null);
        }
    };

    const handleRemoveContact = async (contact) => {
        setContactActionId(contact._id);

        try {
            await removeContactAPI(contact._id);
            messageApi.success('Contact removed.');
            await loadContacts();
        } catch (error) {
            messageApi.error(error.response?.data?.message || 'Could not remove contact.');
        } finally {
            setContactActionId(null);
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

    const getOutgoingRequestForUser = (userId) => {
        return contactsState.outgoingRequests.find((request) => {
            return request.otherUser?._id === userId || request.recipient?._id === userId;
        });
    };

    const getIncomingRequestForUser = (userId) => {
        return contactsState.incomingRequests.find((request) => {
            return request.otherUser?._id === userId || request.requester?._id === userId;
        });
    };

    const renderContactSearchAction = (searchUser) => {
        const incomingRequest = getIncomingRequestForUser(searchUser._id);
        const outgoingRequest = getOutgoingRequestForUser(searchUser._id);
        const relationshipStatus = searchUser.relationshipStatus;

        if (relationshipStatus === 'contact') {
            return (
                <button
                    className={styles.compactActionBtn}
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleStartChat(searchUser);
                    }}
                    disabled={creatingUserId === searchUser._id}
                    title="Message"
                    aria-label={`Message ${searchUser.username}`}
                >
                    <MessageOutlined />
                </button>
            );
        }

        if (relationshipStatus === 'incoming_pending' && incomingRequest) {
            return (
                <div className={styles.inlineActions}>
                    <button
                        className={styles.compactActionBtn}
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleAcceptContactRequest(incomingRequest);
                        }}
                        disabled={contactActionId === incomingRequest._id}
                        title="Accept"
                        aria-label={`Accept ${searchUser.username}`}
                    >
                        <CheckOutlined />
                    </button>
                    <button
                        className={styles.compactActionBtn}
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleDeclineContactRequest(incomingRequest);
                        }}
                        disabled={contactActionId === incomingRequest._id}
                        title="Decline"
                        aria-label={`Decline ${searchUser.username}`}
                    >
                        <CloseOutlined />
                    </button>
                </div>
            );
        }

        if (relationshipStatus === 'outgoing_pending') {
            return (
                <button
                    className={styles.contactStatusBtn}
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        if (outgoingRequest) handleCancelContactRequest(outgoingRequest);
                    }}
                    disabled={!outgoingRequest || contactActionId === outgoingRequest._id}
                >
                    Sent
                </button>
            );
        }

        return (
            <button
                className={styles.compactActionBtn}
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    handleSendContactRequest(searchUser);
                }}
                disabled={contactActionId === searchUser._id}
                title="Add contact"
                aria-label={`Add ${searchUser.username}`}
            >
                <UserAddOutlined />
            </button>
        );
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

            <div className={`${styles.actions} ${activeSection === 'contacts' ? styles.contactActions : ''}`}>
                <SidebarSearch
                    value={searchQuery}
                    onChange={handleSearchUsers}
                    placeholder={activeSection === 'contacts' ? 'Search people' : 'Search'}
                />

                {activeSection !== 'contacts' && (
                    <button
                        className={`${styles.createGroupBtn} ${showGroupModal ? styles.createGroupActive : ''}`}
                        onClick={() => setShowGroupModal((current) => !current)}
                        title="Create group"
                        aria-label="Create group"
                        type="button"
                    >
                        <UsergroupAddOutlined />
                    </button>
                )}
            </div>

            {showGroupModal && activeSection !== 'contacts' && (
                <CreateGroupModal
                    onClose={() => setShowGroupModal(false)}
                    onCreated={(newGroup) => {
                        handleConversationCreated(newGroup);
                        setShowGroupModal(false);
                    }}
                />
            )}

            <div className={styles.list} ref={listRef} onScroll={handleConversationListScroll}>
                {activeSection === 'contacts' ? (
                    searchQuery.trim() ? (
                        <>
                            {searchLoading && <p className={styles.empty}>Searching...</p>}

                            {!searchLoading && searchResults.length === 0 && (
                                <p className={styles.empty}>No people found.</p>
                            )}

                            {!searchLoading && searchResults.map((searchUser) => (
                                <div key={searchUser._id} className={styles.contactRow}>
                                    <UserAvatar
                                        user={searchUser}
                                        className={styles.convAvatar}
                                    />
                                    <div className={styles.contactInfo}>
                                        <span className={styles.contactName}>{searchUser.username}</span>
                                        <span className={styles.contactMeta}>
                                            {searchUser.relationshipStatus === 'contact'
                                                ? 'In your contacts'
                                                : searchUser.relationshipStatus === 'incoming_pending'
                                                    ? 'Sent you a request'
                                                    : searchUser.relationshipStatus === 'outgoing_pending'
                                                        ? 'Request pending'
                                                        : 'Not connected'}
                                        </span>
                                    </div>
                                    {renderContactSearchAction(searchUser)}
                                </div>
                            ))}
                        </>
                    ) : isLoadingContacts ? (
                        <div className={styles.skeletonList} aria-label="Loading contacts">
                            {[0, 1, 2].map((item) => (
                                <div className={styles.skeletonItem} key={item}>
                                    <span className={styles.skeletonAvatar} />
                                    <span className={styles.skeletonContent}>
                                        <span className={styles.skeletonLine} />
                                        <span className={styles.skeletonLineShort} />
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.contactSections}>
                            {contactsState.incomingRequests.length > 0 && (
                                <section className={styles.contactSection}>
                                    <h3>Requests</h3>
                                    {contactsState.incomingRequests.map((request) => (
                                        <div key={request._id} className={styles.contactRow}>
                                            <UserAvatar
                                                user={request.otherUser}
                                                className={styles.convAvatar}
                                            />
                                            <div className={styles.contactInfo}>
                                                <span className={styles.contactName}>{request.otherUser?.username}</span>
                                                <span className={styles.contactMeta}>Wants to connect</span>
                                            </div>
                                            <div className={styles.inlineActions}>
                                                <button
                                                    className={styles.compactActionBtn}
                                                    type="button"
                                                    onClick={() => handleAcceptContactRequest(request)}
                                                    disabled={contactActionId === request._id}
                                                    title="Accept"
                                                    aria-label="Accept request"
                                                >
                                                    <CheckOutlined />
                                                </button>
                                                <button
                                                    className={styles.compactActionBtn}
                                                    type="button"
                                                    onClick={() => handleDeclineContactRequest(request)}
                                                    disabled={contactActionId === request._id}
                                                    title="Decline"
                                                    aria-label="Decline request"
                                                >
                                                    <CloseOutlined />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </section>
                            )}

                            {contactsState.outgoingRequests.length > 0 && (
                                <section className={styles.contactSection}>
                                    <h3>Sent</h3>
                                    {contactsState.outgoingRequests.map((request) => (
                                        <div key={request._id} className={styles.contactRow}>
                                            <UserAvatar
                                                user={request.otherUser}
                                                className={styles.convAvatar}
                                            />
                                            <div className={styles.contactInfo}>
                                                <span className={styles.contactName}>{request.otherUser?.username}</span>
                                                <span className={styles.contactMeta}>Waiting for response</span>
                                            </div>
                                            <button
                                                className={styles.contactStatusBtn}
                                                type="button"
                                                onClick={() => handleCancelContactRequest(request)}
                                                disabled={contactActionId === request._id}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ))}
                                </section>
                            )}

                            {contactsState.contacts.length > 0 && (
                                <section className={styles.contactSection}>
                                    <h3>Contacts</h3>
                                    {contactsState.contacts.map((contact) => (
                                        <div key={contact._id} className={styles.contactRow}>
                                            <UserAvatar
                                                user={contact}
                                                className={styles.convAvatar}
                                            />
                                            <div className={styles.contactInfo}>
                                                <span className={styles.contactName}>{contact.username}</span>
                                                <span className={styles.contactMeta}>{contact.email}</span>
                                            </div>
                                            <div className={styles.inlineActions}>
                                                <button
                                                    className={styles.compactActionBtn}
                                                    type="button"
                                                    onClick={() => handleStartChat(contact)}
                                                    disabled={creatingUserId === contact._id}
                                                    title="Message"
                                                    aria-label={`Message ${contact.username}`}
                                                >
                                                    <MessageOutlined />
                                                </button>
                                                <button
                                                    className={styles.compactActionBtn}
                                                    type="button"
                                                    onClick={() => handleRemoveContact(contact)}
                                                    disabled={contactActionId === contact._id}
                                                    title="Remove contact"
                                                    aria-label={`Remove ${contact.username}`}
                                                >
                                                    <DeleteOutlined />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </section>
                            )}

                            {contactsState.contacts.length === 0
                                && contactsState.incomingRequests.length === 0
                                && contactsState.outgoingRequests.length === 0 && (
                                    <div className={styles.emptyState}>
                                        <div className={styles.emptyIcon}>
                                            <ContactsOutlined />
                                        </div>
                                        <p>No contacts yet</p>
                                        <span>Search for someone and send a contact request.</span>
                                    </div>
                                )}
                        </div>
                    )
                ) : searchQuery.trim() ? (
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
                ) : displayedConversations.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                            <TeamOutlined />
                        </div>
                        <p>{activeSection === 'groups' ? 'No groups yet' : 'No conversations yet'}</p>
                        <span>
                            {activeSection === 'groups'
                                ? 'Create a group to chat with several people.'
                                : 'Search for someone or create a group to start chatting.'}
                        </span>
                    </div>
                ) : (
                    <>
                    {displayedConversations.map((conv) => {
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
                                        {getConversationDisplayTime(conv) ? formatRelativeTime(getConversationDisplayTime(conv)) : ''}
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
                    {isLoadingMoreConversations && (
                        <div className={styles.loadMoreState}>Loading more...</div>
                    )}
                    {!isLoadingMoreConversations && hasMoreConversations && (
                        <button
                            className={styles.loadMoreButton}
                            onClick={loadMoreConversations}
                            type="button"
                        >
                            Load more
                        </button>
                    )}
                    </>
                )}
            </div>
        </aside>
        </>
    );
}
