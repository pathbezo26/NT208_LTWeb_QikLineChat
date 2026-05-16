import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Drawer, Input, List, Spin } from 'antd';
import { DeleteOutlined, MessageOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';
import axiosInstance from '../api/axiosInstance';
import {
    addGroupMembersAPI,
    removeGroupMemberAPI,
} from '../api/conversationAPI';
import { getMessagesAPI } from '../api/messageAPI';
import useSocket from '../hooks/useSocket';
import useAuth from '../hooks/useAuth';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import UserAvatar from './UserAvatar';
import styles from './styles/ChatWindow.module.css';

const MESSAGE_PAGE_SIZE = 30;

const createClientMessageId = () => {
    return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getMessageKey = (message) => message._id || message.clientMessageId;

const mergeMessages = (currentMessages, incomingMessages) => {
    const messagesById = new Map();

    [...currentMessages, ...incomingMessages].forEach((message) => {
        const key = getMessageKey(message);
        if (!key) return;

        messagesById.set(key, message);
    });

    return Array.from(messagesById.values()).sort((first, second) => {
        return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
    });
};

const getDeletedAtForUser = (conversation, userId) => {
    if (conversation?.deletedAt) return conversation.deletedAt;

    const deletedAtBy = conversation?.deletedAtBy;
    if (!deletedAtBy || !userId) return null;

    if (deletedAtBy instanceof Map) {
        return deletedAtBy.get(userId) || null;
    }

    return deletedAtBy[userId] || null;
};

const filterMessagesAfterDeletedAt = (items, deletedAt) => {
    if (!deletedAt) return items || [];

    const deletedTime = new Date(deletedAt).getTime();
    if (Number.isNaN(deletedTime)) return items || [];

    return (items || []).filter((message) => {
        return new Date(message.createdAt).getTime() > deletedTime;
    });
};

export default function ChatWindow({ conversation, onConversationUpdated }) {
    const socket = useSocket();
    const { user } = useAuth();

    const [messages, setMessages] = useState([]);
    const [messagesConversationId, setMessagesConversationId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [entryUnreadCount, setEntryUnreadCount] = useState(0);
    const [typingUsers, setTypingUsers] = useState([]);
    const activeConversationIdRef = useRef(null);
    const isLoadingOlderRef = useRef(false);
    const messageCacheRef = useRef(new Map());

    const [isMemberDrawerOpen, setIsMemberDrawerOpen] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [memberSearchResults, setMemberSearchResults] = useState([]);
    const [isSearchingMembers, setIsSearchingMembers] = useState(false);
    const [memberActionId, setMemberActionId] = useState(null);
    const [memberError, setMemberError] = useState('');

    useEffect(() => {
        activeConversationIdRef.current = conversation?._id || null;
    }, [conversation?._id]);

    useEffect(() => {
        if (!messagesConversationId) return;

        messageCacheRef.current.set(messagesConversationId, {
            messages,
            hasMore: hasMoreMessages,
            nextCursor,
        });
    }, [hasMoreMessages, messages, messagesConversationId, nextCursor]);

    useEffect(() => {
        if (!conversation) return;

        let ignore = false;
        const requestConversationId = conversation._id;
        const deletedAt = getDeletedAtForUser(conversation, user._id);
        const cachedState = messageCacheRef.current.get(requestConversationId);
        const cachedMessages = filterMessagesAfterDeletedAt(cachedState?.messages, deletedAt);
        const initialUnreadCount = conversation.unreadCount || 0;

        const fetchMessages = async () => {
            setIsLoading(!cachedState);

            try {
                const data = await getMessagesAPI(requestConversationId, { limit: MESSAGE_PAGE_SIZE });

                if (!ignore && activeConversationIdRef.current === requestConversationId) {
                    if (cachedState) {
                        setMessages((prevMessages) => {
                            const visiblePreviousMessages = filterMessagesAfterDeletedAt(prevMessages, deletedAt);
                            return mergeMessages(visiblePreviousMessages, data.messages || []);
                        });
                        setMessagesConversationId(requestConversationId);
                        setHasMoreMessages(Boolean(deletedAt ? data.hasMore : cachedState.hasMore || data.hasMore));
                        setNextCursor(deletedAt ? data.nextCursor || null : cachedState.nextCursor || data.nextCursor || null);
                        return;
                    }

                    setMessages(data.messages || []);
                    setMessagesConversationId(requestConversationId);
                    setHasMoreMessages(Boolean(data.hasMore));
                    setNextCursor(data.nextCursor || null);
                }
            } catch (error) {
                console.error('Load messages error:', error);
            } finally {
                if (!ignore) setIsLoading(false);
            }
        };

        if (cachedState) {
            setMessages(cachedMessages);
            setMessagesConversationId(requestConversationId);
            setHasMoreMessages(Boolean(deletedAt ? false : cachedState.hasMore));
            setNextCursor(deletedAt ? null : cachedState.nextCursor || null);
        } else {
            setMessages([]);
            setMessagesConversationId(requestConversationId);
            setHasMoreMessages(false);
            setNextCursor(null);
        }

        isLoadingOlderRef.current = false;
        setIsLoadingOlder(false);
        setEntryUnreadCount(initialUnreadCount);
        setTypingUsers([]);
        fetchMessages();

        return () => {
            ignore = true;
        };
    }, [conversation, user._id]);

    useEffect(() => {
        if (!socket || !conversation) return;

        socket.emit('joinRoom', conversation._id);

        return () => {
            socket.emit('leaveRoom', conversation._id);
        };
    }, [socket, conversation]);

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (newMessage) => {
            if (newMessage.conversationId?.toString() !== activeConversationIdRef.current) return;

            setMessages((prevMessages) => {
                const matchingClientMessage = newMessage.clientMessageId
                    ? prevMessages.find((msg) => msg.clientMessageId === newMessage.clientMessageId)
                    : null;

                if (matchingClientMessage) {
                    return prevMessages.map((msg) => {
                        if (msg.clientMessageId !== newMessage.clientMessageId) return msg;

                        return newMessage;
                    });
                }

                const isMessageExist = prevMessages.find((msg) => msg._id === newMessage._id);
                if (isMessageExist) {
                    return prevMessages.map((msg) => {
                        if (msg._id !== newMessage._id) return msg;

                        return { ...msg, status: msg.status || 'sent' };
                    });
                }

                return [...prevMessages, newMessage];
            });
        };

        socket.on('newMessage', handleNewMessage);

        return () => socket.off('newMessage', handleNewMessage);
    }, [socket]);

    useEffect(() => {
        if (!socket || !user) return;

        const handleUserTyping = ({ userId, username }) => {
            if (userId === user._id) return;

            setTypingUsers((prevUsers) => {
                const isAlreadyTyping = prevUsers.find((typingUser) => typingUser.userId === userId);
                if (isAlreadyTyping) return prevUsers;

                return [...prevUsers, { userId, username }];
            });
        };

        const handleUserStopTyping = ({ userId }) => {
            setTypingUsers((prevUsers) => {
                return prevUsers.filter((typingUser) => typingUser.userId !== userId);
            });
        };

        socket.on('typing', handleUserTyping);
        socket.on('stopTyping', handleUserStopTyping);

        return () => {
            socket.off('typing', handleUserTyping);
            socket.off('stopTyping', handleUserStopTyping);
        };
    }, [socket, user]);

    useEffect(() => {
        setIsMemberDrawerOpen(false);
        setMemberSearchQuery('');
        setMemberSearchResults([]);
        setMemberError('');
    }, [conversation?._id]);

    const loadOlderMessages = useCallback(async () => {
        if (!conversation || !nextCursor || !hasMoreMessages || isLoadingOlderRef.current) return;

        const requestConversationId = conversation._id;

        isLoadingOlderRef.current = true;
        setIsLoadingOlder(true);

        try {
            const data = await getMessagesAPI(requestConversationId, {
                before: nextCursor,
                limit: MESSAGE_PAGE_SIZE,
            });

            if (activeConversationIdRef.current !== requestConversationId) return;

            const olderMessages = data.messages || [];

            setMessages((prevMessages) => {
                const existingIds = new Set(prevMessages.map((message) => message._id));
                const uniqueOlderMessages = olderMessages.filter((message) => !existingIds.has(message._id));

                return [...uniqueOlderMessages, ...prevMessages];
            });
            setHasMoreMessages(Boolean(data.hasMore));
            setNextCursor(data.nextCursor || null);
        } catch (error) {
            console.error('Load older messages error:', error);
        } finally {
            isLoadingOlderRef.current = false;

            if (activeConversationIdRef.current === requestConversationId) {
                setIsLoadingOlder(false);
            }
        }
    }, [conversation, hasMoreMessages, nextCursor]);

    const markMessageFailed = useCallback((clientMessageId, errorMessage = 'Could not send message.') => {
        setMessages((prevMessages) => {
            return prevMessages.map((message) => {
                if (message.clientMessageId !== clientMessageId) return message;

                return {
                    ...message,
                    status: 'failed',
                    errorMessage,
                };
            });
        });
    }, []);

    const handleSendMessage = useCallback((content, retryClientMessageId = null) => {
        if (!socket || !conversation || !user) return;

        const clientMessageId = retryClientMessageId || createClientMessageId();

        if (!retryClientMessageId) {
            const optimisticMessage = {
                _id: clientMessageId,
                clientMessageId,
                conversationId: conversation._id,
                sender: {
                    _id: user._id,
                    username: user.username,
                    avatar: user.avatar,
                },
                content,
                createdAt: new Date().toISOString(),
                status: 'sending',
            };

            setMessages((prevMessages) => [...prevMessages, optimisticMessage]);
        } else {
            setMessages((prevMessages) => {
                return prevMessages.map((message) => {
                    if (message.clientMessageId !== retryClientMessageId) return message;

                    return {
                        ...message,
                        status: 'sending',
                        errorMessage: '',
                    };
                });
            });
        }

        socket.timeout(10000).emit(
            'sendMessage',
            { conversationId: conversation._id, content, clientMessageId },
            (error, response) => {
                if (activeConversationIdRef.current !== conversation._id) return;

                if (error || !response?.ok) {
                    markMessageFailed(clientMessageId, response?.message);
                    return;
                }

                setMessages((prevMessages) => {
                    const serverMessage = response.message;
                    const withoutOptimistic = prevMessages.filter((message) => {
                        return message.clientMessageId !== clientMessageId && message._id !== serverMessage._id;
                    });

                    return [...withoutOptimistic, serverMessage];
                });
            }
        );
    }, [conversation, markMessageFailed, socket, user]);

    const handleRetryMessage = useCallback((message) => {
        handleSendMessage(message.content, message.clientMessageId);
    }, [handleSendMessage]);

    if (!conversation) {
        return (
            <div className={styles.empty}>
                <div className={styles.emptyIcon}>
                    <MessageOutlined />
                </div>
                <p>Select a conversation to get started</p>
                <span>Send a private message or create a group to chat with friends.</span>
            </div>
        );
    }

    const getOtherMember = () => {
        return conversation.members.find((member) => member._id !== user._id);
    };

    const getChatName = () => {
        if (conversation.type === 'group') {
            return conversation.name || 'Group chat';
        }

        return getOtherMember()?.username || 'User';
    };

    const getUserId = (targetUser) => {
        return typeof targetUser === 'object' ? targetUser._id : targetUser;
    };

    const isGroupOwner = getUserId(conversation.createdBy) === user._id;

    const resetMemberSearch = () => {
        setMemberSearchQuery('');
        setMemberSearchResults([]);
        setMemberError('');
    };

    const handleSearchMembers = async (e) => {
        const keyword = e.target.value;
        setMemberSearchQuery(keyword);

        if (!keyword.trim()) {
            setMemberSearchResults([]);
            setIsSearchingMembers(false);
            return;
        }

        setIsSearchingMembers(true);
        setMemberError('');

        try {
            const response = await axiosInstance.get(`/users/search?q=${encodeURIComponent(keyword)}`);
            const currentMemberIds = new Set(conversation.members.map((member) => member._id));
            const availableUsers = response.data.filter((searchUser) => !currentMemberIds.has(searchUser._id));

            setMemberSearchResults(availableUsers);
        } catch (error) {
            console.error('Search group members error:', error);
            setMemberSearchResults([]);
            setMemberError('Could not find users.');
        } finally {
            setIsSearchingMembers(false);
        }
    };

    const handleAddMember = async (member) => {
        setMemberActionId(member._id);
        setMemberError('');

        try {
            const data = await addGroupMembersAPI(conversation._id, [member._id]);
            onConversationUpdated(data.conversation);
            resetMemberSearch();
        } catch (error) {
            setMemberError(error.response?.data?.message || 'Could not add member.');
        } finally {
            setMemberActionId(null);
        }
    };

    const handleRemoveMember = async (member) => {
        setMemberActionId(member._id);
        setMemberError('');

        try {
            const data = await removeGroupMemberAPI(conversation._id, member._id);
            onConversationUpdated(data.conversation);
        } catch (error) {
            setMemberError(error.response?.data?.message || 'Could not remove member.');
        } finally {
            setMemberActionId(null);
        }
    };

    const cachedDisplayState = messageCacheRef.current.get(conversation._id);
    const deletedAt = getDeletedAtForUser(conversation, user._id);
    const isMessageStateReady = messagesConversationId === conversation._id;
    const displayedMessages = isMessageStateReady
        ? filterMessagesAfterDeletedAt(messages, deletedAt)
        : filterMessagesAfterDeletedAt(cachedDisplayState?.messages, deletedAt);
    const displayedHasMoreMessages = isMessageStateReady
        ? hasMoreMessages
        : Boolean(cachedDisplayState?.hasMore);
    const shouldShowInitialSkeleton = !isMessageStateReady
        ? !cachedDisplayState
        : isLoading && displayedMessages.length === 0;

    return (
        <div className={styles.window}>
            <div className={styles.header}>
                <UserAvatar
                    user={conversation.type === 'private' ? getOtherMember() : null}
                    name={conversation.type === 'group' ? (conversation.name || 'Group') : getChatName()}
                    src={conversation.type === 'group' ? conversation.avatar?.url : undefined}
                    className={styles.headerAvatar}
                    fallback={conversation.type === 'group' ? 'G' : '?'}
                />

                <div className={styles.headerInfo}>
                    <span className={styles.headerName}>{getChatName()}</span>
                    {conversation.type === 'group' && (
                        <button
                            className={styles.memberCount}
                            onClick={() => setIsMemberDrawerOpen(true)}
                            type="button"
                        >
                            <TeamOutlined />
                            {conversation.members.length} members
                        </button>
                    )}
                    {conversation.type === 'private' && (
                        <span className={styles.chatStatus}>Direct message</span>
                    )}
                </div>
            </div>

            <MessageList
                messages={displayedMessages}
                currentUserId={user._id}
                hasMore={displayedHasMoreMessages}
                conversationId={conversation._id}
                initialUnreadCount={entryUnreadCount}
                isInitialLoading={shouldShowInitialSkeleton}
                isLoadingOlder={isLoadingOlder}
                onLoadOlder={loadOlderMessages}
                onRetryMessage={handleRetryMessage}
            />

            {typingUsers.length > 0 && (
                <div className={styles.typing}>
                    {typingUsers.map((typingUser) => typingUser.username).join(', ')} typing...
                </div>
            )}

            <ChatInput conversationId={conversation._id} onSendMessage={handleSendMessage} />

            <Drawer
                title="Group members"
                open={isMemberDrawerOpen}
                onClose={() => setIsMemberDrawerOpen(false)}
                width={360}
            >
                {memberError && (
                    <Alert
                        type="error"
                        message={memberError}
                        showIcon
                        style={{ marginBottom: 12 }}
                    />
                )}

                <Input
                    prefix={<UserAddOutlined />}
                    value={memberSearchQuery}
                    onChange={handleSearchMembers}
                    placeholder="Search people to add to the group"
                    allowClear
                    style={{ marginBottom: 12 }}
                />

                {isSearchingMembers && (
                    <Spin size="small" style={{ marginBottom: 12 }} />
                )}

                {memberSearchResults.length > 0 && (
                    <List
                        size="small"
                        dataSource={memberSearchResults}
                        style={{ marginBottom: 18 }}
                        renderItem={(searchUser) => (
                            <List.Item
                                actions={[
                                    <Button
                                        key="add"
                                        type="link"
                                        loading={memberActionId === searchUser._id}
                                        onClick={() => handleAddMember(searchUser)}
                                    >
                                        Add
                                    </Button>,
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={<UserAvatar user={searchUser} className={styles.drawerAvatar} />}
                                    title={searchUser.username}
                                />
                            </List.Item>
                        )}
                    />
                )}

                <List
                    size="small"
                    dataSource={conversation.members}
                    renderItem={(member) => {
                        const canRemoveMember = isGroupOwner && member._id !== user._id;

                        return (
                            <List.Item
                                actions={canRemoveMember ? [
                                    <Button
                                        key="remove"
                                        danger
                                        type="text"
                                        icon={<DeleteOutlined />}
                                        loading={memberActionId === member._id}
                                        onClick={() => handleRemoveMember(member)}
                                    />,
                                ] : []}
                            >
                                <List.Item.Meta
                                    avatar={<UserAvatar user={member} className={styles.drawerAvatar} />}
                                    title={member.username}
                                />
                            </List.Item>
                        );
                    }}
                />
            </Drawer>
        </div>
    );
}
