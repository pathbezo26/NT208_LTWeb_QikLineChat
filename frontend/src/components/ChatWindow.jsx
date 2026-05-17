import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Select, message as antdMessage } from 'antd';
import { InfoCircleOutlined, MessageOutlined, TeamOutlined } from '@ant-design/icons';
import { getConversationsAPI } from '../api/conversationAPI';
import { getMessagesAPI, sendMessageAPI, uploadMessageAttachmentsAPI } from '../api/messageAPI';
import useSocket from '../hooks/useSocket';
import useAuth from '../hooks/useAuth';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import UserAvatar from './UserAvatar';
import GroupDetailsDrawer from './GroupDetailsDrawer';
import styles from './styles/ChatWindow.module.css';

const MESSAGE_PAGE_SIZE = 30;

const createClientMessageId = () => {
    return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getMessageKey = (message) => message._id || message.clientMessageId;

const getUserId = (user) => {
    if (!user) return null;
    return typeof user === 'object' ? (user._id || user.id || user.toString?.()) : user;
};

const addUniqueUserId = (items = [], userId) => {
    const safeItems = Array.isArray(items) ? items : [];
    const ids = safeItems.map(getUserId).filter(Boolean);
    if (ids.includes(userId)) return items;
    return [...safeItems, userId];
};

const buildMessageReference = (message) => {
    if (!message) return null;

    return {
        messageId: message._id || message.messageId,
        sender: message.sender,
        content: message.content || getMessagePreviewContent(message),
        createdAt: message.createdAt,
    };
};

const getMessagePreviewContent = (message) => {
    const content = message?.content?.trim();
    if (content) return content;

    const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
    if (attachments.length === 0) return '';

    const hasImage = attachments.some((attachment) => attachment.type === 'image');
    if (hasImage && attachments.length === 1) return 'Photo';
    if (hasImage) return `${attachments.length} attachments`;

    return attachments.length === 1 ? 'File' : `${attachments.length} files`;
};

const mergeServerMessage = (serverMessage, fallbackMessage = {}) => {
    return {
        ...serverMessage,
        attachments: serverMessage.attachments?.length
            ? serverMessage.attachments
            : fallbackMessage.attachments || [],
        replyTo: serverMessage.replyTo?.messageId || serverMessage.replyTo?.content
            ? serverMessage.replyTo
            : fallbackMessage.replyTo,
        forwardedFrom: serverMessage.forwardedFrom?.messageId || serverMessage.forwardedFrom?.content
            ? serverMessage.forwardedFrom
            : fallbackMessage.forwardedFrom,
    };
};

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

export default function ChatWindow({
    conversation,
    onConversationUpdated,
    onConversationPreviewUpdate,
    onConversationLeft,
}) {
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

    const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);
    const [replyToMessage, setReplyToMessage] = useState(null);
    const [forwardMessage, setForwardMessage] = useState(null);
    const [forwardTargetId, setForwardTargetId] = useState(null);
    const [forwardConversations, setForwardConversations] = useState([]);
    const [isForwardLoading, setIsForwardLoading] = useState(false);
    const [isForwarding, setIsForwarding] = useState(false);
    const [messageApi, contextHolder] = antdMessage.useMessage();

    const markActiveConversationRead = useCallback((conversationId) => {
        if (!socket || !conversationId) return;

        socket.emit('markMessagesRead', { conversationId });
    }, [socket]);

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
        if (!conversation || !user?._id) return;

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
        markActiveConversationRead(requestConversationId);

        return () => {
            ignore = true;
        };
    }, [conversation, markActiveConversationRead, user?._id]);

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

                        return mergeServerMessage(newMessage, msg);
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

            if (getUserId(newMessage.sender) !== user?._id) {
                markActiveConversationRead(newMessage.conversationId);
            }
        };

        const handleMessageStatusUpdated = ({ conversationId, userId: readerId, status }) => {
            if (conversationId?.toString() !== activeConversationIdRef.current || !readerId) return;

            setMessages((prevMessages) => {
                return prevMessages.map((message) => {
                    if (getUserId(message.sender) === readerId) return message;

                    const nextMessage = {
                        ...message,
                        deliveredTo: addUniqueUserId(message.deliveredTo, readerId),
                    };

                    if (status === 'read') {
                        nextMessage.readBy = addUniqueUserId(message.readBy, readerId);
                    }

                    return nextMessage;
                });
            });
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('messageStatusUpdated', handleMessageStatusUpdated);

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('messageStatusUpdated', handleMessageStatusUpdated);
        };
    }, [markActiveConversationRead, socket, user?._id]);

    useEffect(() => {
        if (!socket || !user?._id) return;

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
        setIsGroupDetailsOpen(false);
        setReplyToMessage(null);
    }, [conversation?._id]);

    useEffect(() => {
        if (!forwardMessage) return;

        let ignore = false;

        const loadForwardConversations = async () => {
            setIsForwardLoading(true);

            try {
                const data = await getConversationsAPI();
                if (!ignore) {
                    setForwardConversations(data);
                    setForwardTargetId(data[0]?._id || null);
                }
            } catch (error) {
                console.error('Load forward conversations error:', error);
                if (!ignore) messageApi.error('Could not load conversations.');
            } finally {
                if (!ignore) setIsForwardLoading(false);
            }
        };

        loadForwardConversations();

        return () => {
            ignore = true;
        };
    }, [forwardMessage, messageApi]);

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

    const handleSendMessage = useCallback((content, retryClientMessageId = null, options = {}) => {
        if (!socket || !conversation || !user) return;

        const clientMessageId = retryClientMessageId || createClientMessageId();
        const replyReference = options.replyToMessage ? buildMessageReference(options.replyToMessage) : null;
        const attachments = Array.isArray(options.attachments) ? options.attachments : [];
        const uploadFiles = Array.isArray(options.files) ? options.files : [];

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
                content: content || '',
                attachments,
                uploadFiles,
                createdAt: new Date().toISOString(),
                status: 'sending',
                replyTo: replyReference,
            };

            setMessages((prevMessages) => [...prevMessages, optimisticMessage]);
            onConversationPreviewUpdate?.({
                conversationId: conversation._id,
                clientMessageId,
                content: getMessagePreviewContent(optimisticMessage),
                createdAt: optimisticMessage.createdAt,
                sender: optimisticMessage.sender,
            });
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

        const replaceOptimisticMessage = (serverMessage) => {
            setMessages((prevMessages) => {
                const withoutOptimistic = prevMessages.filter((message) => {
                    return message.clientMessageId !== clientMessageId && message._id !== serverMessage._id;
                });
                const optimisticMessage = prevMessages.find((message) => message.clientMessageId === clientMessageId);

                return [...withoutOptimistic, mergeServerMessage(serverMessage, optimisticMessage)];
            });

            if (options.replyToMessage) {
                setReplyToMessage(null);
            }
        };

        const sendViaRestFallback = async (uploadedAttachments, fallbackErrorMessage) => {
            try {
                const serverMessage = await sendMessageAPI({
                    conversationId: conversation._id,
                    content,
                    attachments: uploadedAttachments,
                    replyToMessageId: options.replyToMessage?._id || options.replyToMessage?.messageId,
                });

                replaceOptimisticMessage(serverMessage);
            } catch (restError) {
                markMessageFailed(
                    clientMessageId,
                    restError.response?.data?.message || fallbackErrorMessage || restError.message
                );
            }
        };

        const sendWithUploadedAttachments = (uploadedAttachments) => {
            socket.timeout(10000).emit(
            'sendMessage',
            {
                conversationId: conversation._id,
                content,
                attachments: uploadedAttachments,
                clientMessageId,
                replyToMessageId: options.replyToMessage?._id || options.replyToMessage?.messageId,
            },
            (error, response) => {
                if (activeConversationIdRef.current !== conversation._id) return;

                if (error || !response?.ok) {
                    if (uploadedAttachments.length > 0) {
                        sendViaRestFallback(uploadedAttachments, response?.message || error?.message);
                        return;
                    }

                    markMessageFailed(clientMessageId, response?.message || error?.message);
                    return;
                }

                replaceOptimisticMessage(response.message);
            }
            );
        };

        const uploadThenSend = async () => {
            try {
                const uploadedAttachments = uploadFiles.length > 0
                    ? (await uploadMessageAttachmentsAPI(conversation._id, uploadFiles)).attachments || []
                    : attachments;

                if (uploadFiles.length > 0 && uploadedAttachments.length === 0) {
                    throw new Error('Could not upload attachment.');
                }

                sendWithUploadedAttachments(uploadedAttachments);
            } catch (error) {
                markMessageFailed(clientMessageId, error.message || error.response?.data?.message);
            }
        };

        uploadThenSend();
    }, [conversation, markMessageFailed, onConversationPreviewUpdate, socket, user]);

    const handleRetryMessage = useCallback((message) => {
        handleSendMessage(message.content, message.clientMessageId, {
            replyToMessage: message.replyTo?.messageId ? message.replyTo : null,
            attachments: message.attachments || [],
            files: message.uploadFiles || [],
        });
    }, [handleSendMessage]);

    const getConversationName = useCallback((targetConversation) => {
        if (!targetConversation) return 'Conversation';
        if (targetConversation.type === 'group') return targetConversation.name || 'Group chat';

        const otherMember = targetConversation.members?.find((member) => getUserId(member) !== user?._id);
        return otherMember?.username || 'User';
    }, [user?._id]);

    const handleForwardMessage = useCallback(async () => {
        if (!socket || !forwardMessage || !forwardTargetId) return;

        setIsForwarding(true);

        socket.timeout(10000).emit(
            'sendMessage',
            {
                conversationId: forwardTargetId,
                content: forwardMessage.content,
                attachments: forwardMessage.attachments || [],
                clientMessageId: createClientMessageId(),
                forwardedFromMessageId: forwardMessage._id,
            },
            (error, response) => {
                setIsForwarding(false);

                if (error || !response?.ok) {
                    messageApi.error(response?.message || 'Could not forward message.');
                    return;
                }

                messageApi.success('Message forwarded.');
                setForwardMessage(null);
                setForwardTargetId(null);
            }
        );
    }, [forwardMessage, forwardTargetId, messageApi, socket]);

    if (!conversation || !user?._id) {
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
        return conversation.members.find((member) => getUserId(member) !== user._id);
    };

    const getChatName = () => {
        if (conversation.type === 'group') {
            return conversation.name || 'Group chat';
        }

        return getOtherMember()?.username || 'User';
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
            {contextHolder}
            <div className={styles.header}>
                <UserAvatar
                    user={conversation.type === 'private' ? getOtherMember() : null}
                    name={conversation.type === 'group' ? (conversation.name || 'Group') : getChatName()}
                    src={conversation.type === 'group' ? conversation.avatar?.url : undefined}
                    className={styles.headerAvatar}
                    fallback={conversation.type === 'group' ? 'G' : '?'}
                />

                <div className={styles.headerInfo}>
                    {conversation.type === 'group' ? (
                        <button
                            className={styles.headerDetailsButton}
                            onClick={() => setIsGroupDetailsOpen(true)}
                            type="button"
                            title="Open group details"
                        >
                            <span className={styles.headerName}>{getChatName()}</span>
                            <span className={styles.memberCount}>
                                <TeamOutlined />
                                {conversation.members.length} members
                            </span>
                        </button>
                    ) : (
                        <span className={styles.headerName}>{getChatName()}</span>
                    )}
                    {conversation.type === 'private' && (
                        <span className={styles.chatStatus}>Direct message</span>
                    )}
                </div>

                {conversation.type === 'group' && (
                    <button
                        className={styles.groupInfoButton}
                        onClick={() => setIsGroupDetailsOpen(true)}
                        type="button"
                        title="Group details"
                        aria-label="Open group details"
                    >
                        <InfoCircleOutlined />
                    </button>
                )}
            </div>

            <MessageList
                messages={displayedMessages}
                currentUserId={user._id}
                hasMore={displayedHasMoreMessages}
                conversationId={conversation._id}
                initialUnreadCount={entryUnreadCount}
                isInitialLoading={shouldShowInitialSkeleton}
                isLoadingOlder={isLoadingOlder}
                conversationMembers={conversation.members}
                onLoadOlder={loadOlderMessages}
                onRetryMessage={handleRetryMessage}
                onReplyMessage={setReplyToMessage}
                onForwardMessage={setForwardMessage}
            />

            {typingUsers.length > 0 && (
                <div className={styles.typing}>
                    {typingUsers.map((typingUser) => typingUser.username).join(', ')} typing...
                </div>
            )}

            <ChatInput
                conversationId={conversation._id}
                onSendMessage={handleSendMessage}
                replyToMessage={replyToMessage}
                onCancelReply={() => setReplyToMessage(null)}
            />

            <Modal
                title="Forward message"
                open={Boolean(forwardMessage)}
                onCancel={() => {
                    setForwardMessage(null);
                    setForwardTargetId(null);
                }}
                onOk={handleForwardMessage}
                confirmLoading={isForwarding}
                okButtonProps={{ disabled: !forwardTargetId }}
                okText="Forward"
            >
                <div className={styles.forwardPreview}>
                    <span className={styles.forwardPreviewLabel}>Message</span>
                    <p>{getMessagePreviewContent(forwardMessage)}</p>
                </div>

                <Select
                    className={styles.forwardSelect}
                    loading={isForwardLoading}
                    value={forwardTargetId}
                    onChange={setForwardTargetId}
                    placeholder="Choose a conversation"
                    options={forwardConversations.map((item) => ({
                        value: item._id,
                        label: getConversationName(item),
                    }))}
                    showSearch
                    optionFilterProp="label"
                />
            </Modal>

            <GroupDetailsDrawer
                open={isGroupDetailsOpen}
                onClose={() => setIsGroupDetailsOpen(false)}
                conversation={conversation}
                currentUser={user}
                messages={displayedMessages}
                onConversationUpdated={onConversationUpdated}
                onConversationLeft={onConversationLeft}
            />
        </div>
    );
}
