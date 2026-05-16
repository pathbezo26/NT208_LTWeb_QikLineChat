import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Badge, Tooltip } from 'antd';
import { UpOutlined } from '@ant-design/icons';
import { formatMessageTime, formatFullTime } from '../utils/formatTime';
import UserAvatar from './UserAvatar';
import styles from './styles/MessageList.module.css';

const getSenderId = (message) => {
    if (!message?.sender) return null;
    return typeof message.sender === 'object' ? (message.sender._id || message.sender.id || message.sender.toString?.()) : message.sender;
};

const getMessageKey = (message) => message._id || message.clientMessageId;

const getUserId = (user) => {
    if (!user) return null;
    return typeof user === 'object' ? (user._id || user.id || user.toString?.()) : user;
};

const hasUserId = (items = [], userId) => {
    if (!Array.isArray(items) || !userId) return false;
    return items.some((item) => getUserId(item)?.toString() === userId?.toString());
};

const SCROLL_TOP_THRESHOLD = 80;
const SCROLL_BOTTOM_THRESHOLD = 120;
const MESSAGE_GROUP_TIME_GAP_MS = 5 * 60 * 1000;

const getMessageTime = (message) => {
    const time = new Date(message?.createdAt).getTime();
    return Number.isNaN(time) ? 0 : time;
};

const isSameMessageGroup = (firstMessage, secondMessage) => {
    if (!firstMessage || !secondMessage) return false;

    const firstSenderId = getSenderId(firstMessage);
    const secondSenderId = getSenderId(secondMessage);
    if (!firstSenderId || firstSenderId !== secondSenderId) return false;

    return Math.abs(getMessageTime(firstMessage) - getMessageTime(secondMessage)) <= MESSAGE_GROUP_TIME_GAP_MS;
};

export default function MessageList({
    messages,
    currentUserId,
    hasMore,
    conversationId,
    initialUnreadCount,
    isInitialLoading,
    isLoadingOlder,
    conversationMembers = [],
    onLoadOlder,
    onRetryMessage,
}) {
    const listRef = useRef(null);
    const messagesEndRef = useRef(null);
    const previousMessageCountRef = useRef(0);
    const previousLastMessageIdRef = useRef(null);
    const shouldStickToBottomRef = useRef(true);
    const preserveScrollRef = useRef(null);
    const unreadMessageRefs = useRef(new Map());
    const seenUnreadMessageIdsRef = useRef(new Set());
    const unreadCount = initialUnreadCount || 0;
    const [remainingUnreadCount, setRemainingUnreadCount] = useState(unreadCount);

    const isNearBottom = useCallback(() => {
        const list = listRef.current;
        if (!list) return true;

        return list.scrollHeight - list.scrollTop - list.clientHeight < SCROLL_BOTTOM_THRESHOLD;
    }, []);

    const getUnreadMessageIds = useCallback(() => {
        if (unreadCount <= 0 || !messages.length) return [];

        const firstUnreadIndex = Math.max(messages.length - unreadCount, 0);

        return messages
            .slice(firstUnreadIndex)
            .map(getMessageKey)
            .filter(Boolean);
    }, [messages, unreadCount]);

    const updateSeenUnreadMessages = useCallback(() => {
        const list = listRef.current;
        if (!list || unreadCount <= 0) return;

        const listRect = list.getBoundingClientRect();
        const unreadMessageIds = getUnreadMessageIds();
        let hasNewSeenMessage = false;

        unreadMessageIds.forEach((messageId) => {
            if (seenUnreadMessageIdsRef.current.has(messageId)) return;

            const messageNode = unreadMessageRefs.current.get(messageId);
            if (!messageNode) return;

            const messageRect = messageNode.getBoundingClientRect();
            const visibleHeight = Math.min(messageRect.bottom, listRect.bottom)
                - Math.max(messageRect.top, listRect.top);
            const minimumReadableHeight = Math.min(messageRect.height * 0.5, 48);

            if (visibleHeight >= minimumReadableHeight) {
                seenUnreadMessageIdsRef.current.add(messageId);
                hasNewSeenMessage = true;
            }
        });

        if (!hasNewSeenMessage) return;

        setRemainingUnreadCount(Math.max(unreadCount - seenUnreadMessageIdsRef.current.size, 0));
    }, [getUnreadMessageIds, unreadCount]);

    const handleScroll = useCallback(() => {
        const list = listRef.current;
        if (!list) return;

        shouldStickToBottomRef.current = isNearBottom();
        updateSeenUnreadMessages();

        if (list.scrollTop > SCROLL_TOP_THRESHOLD || !hasMore || isLoadingOlder || !onLoadOlder) return;

        preserveScrollRef.current = {
            height: list.scrollHeight,
            top: list.scrollTop,
        };
        onLoadOlder();
    }, [hasMore, isLoadingOlder, isNearBottom, onLoadOlder, updateSeenUnreadMessages]);

    useLayoutEffect(() => {
        previousMessageCountRef.current = 0;
        previousLastMessageIdRef.current = null;
        preserveScrollRef.current = null;
        shouldStickToBottomRef.current = true;
        unreadMessageRefs.current.clear();
        seenUnreadMessageIdsRef.current.clear();
        requestAnimationFrame(() => setRemainingUnreadCount(unreadCount));
    }, [conversationId, unreadCount]);

    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return;

        if (preserveScrollRef.current) {
            const previousScroll = preserveScrollRef.current;
            list.scrollTop = list.scrollHeight - previousScroll.height + previousScroll.top;
            preserveScrollRef.current = null;
            previousMessageCountRef.current = messages.length;
            previousLastMessageIdRef.current = messages.at(-1)?._id || null;
            return;
        }

        const previousMessageCount = previousMessageCountRef.current;
        const previousLastMessageId = previousLastMessageIdRef.current;
        const lastMessageId = messages.at(-1)?._id || null;
        const didAppendMessage = messages.length >= previousMessageCount && lastMessageId !== previousLastMessageId;

        if (previousMessageCount === 0 || (didAppendMessage && shouldStickToBottomRef.current)) {
            messagesEndRef.current?.scrollIntoView({
                behavior: previousMessageCount === 0 ? 'auto' : 'smooth',
            });
        }

        requestAnimationFrame(updateSeenUnreadMessages);

        previousMessageCountRef.current = messages.length;
        previousLastMessageIdRef.current = lastMessageId;
    }, [messages, updateSeenUnreadMessages]);

    const setUnreadMessageRef = useCallback((messageId, node) => {
        if (!messageId) return;

        if (node) {
            unreadMessageRefs.current.set(messageId, node);
            return;
        }

        unreadMessageRefs.current.delete(messageId);
    }, []);

    const handleJumpToUnread = () => {
        const list = listRef.current;
        if (!list) return;

        list.scrollTo({
            top: Math.max(list.scrollTop - list.clientHeight * 0.9, 0),
            behavior: 'smooth',
        });
    };

    const getMyMessageStatus = (message) => {
        if (message.status === 'sending' || message.status === 'failed') return '';

        const recipientIds = (Array.isArray(conversationMembers) ? conversationMembers : [])
            .map(getUserId)
            .filter((memberId) => memberId && memberId !== currentUserId);

        if (recipientIds.length === 0) return 'Sent';

        const readCount = recipientIds.filter((memberId) => hasUserId(message.readBy, memberId)).length;
        if (readCount > 0) {
            return recipientIds.length === 1 ? 'Read' : `Read ${readCount}/${recipientIds.length}`;
        }

        const deliveredCount = recipientIds.filter((memberId) => hasUserId(message.deliveredTo, memberId)).length;
        if (deliveredCount > 0) {
            return recipientIds.length === 1 ? 'Delivered' : `Delivered ${deliveredCount}/${recipientIds.length}`;
        }

        return 'Sent';
    };

    if (isInitialLoading) {
        return (
            <div className={styles.list} ref={listRef}>
                <div className={`${styles.skeletonRow} ${styles.skeletonOther}`}>
                    <span className={styles.skeletonAvatar} />
                    <span className={styles.skeletonBubble} />
                </div>
                <div className={`${styles.skeletonRow} ${styles.skeletonOwn}`}>
                    <span className={styles.skeletonBubbleShort} />
                </div>
                <div className={`${styles.skeletonRow} ${styles.skeletonOther}`}>
                    <span className={styles.skeletonAvatar} />
                    <span className={styles.skeletonBubbleWide} />
                </div>
            </div>
        );
    }

    if (!messages || messages.length === 0) {
        return (
            <div className={styles.empty} ref={listRef}>
                <p>No messages yet. Start the conversation!</p>
            </div>
        );
    }

    return (
        <div className={styles.list} ref={listRef} onScroll={handleScroll}>
            {hasMore && (
                <div className={styles.historyLoader}>
                    {isLoadingOlder ? 'Loading older messages...' : 'Scroll up for older messages'}
                </div>
            )}

            {messages.map((message, index) => {
                const senderId = getSenderId(message);
                const isMyMessage = senderId === currentUserId;
                const previousMessage = messages[index - 1];
                const nextMessage = messages[index + 1];
                const isFirstInGroup = !isSameMessageGroup(previousMessage, message);
                const isLastInGroup = !isSameMessageGroup(message, nextMessage);
                const shouldShowAvatar = !isMyMessage && isFirstInGroup;
                const senderName = message.sender?.username || 'User';
                const isSending = isMyMessage && message.status === 'sending';
                const isFailed = isMyMessage && message.status === 'failed';
                const myMessageStatus = isMyMessage ? getMyMessageStatus(message) : '';
                const shouldShowMeta = isLastInGroup || isSending || isFailed;
                const messageKey = getMessageKey(message);
                const firstUnreadIndex = Math.max(messages.length - unreadCount, 0);
                const isInitialUnreadMessage = unreadCount > 0 && index >= firstUnreadIndex;

                return (
                    <div
                        key={messageKey || index}
                        ref={isInitialUnreadMessage ? (node) => setUnreadMessageRef(messageKey, node) : undefined}
                        className={`${styles.row} ${isMyMessage ? styles.own : styles.other} ${isFirstInGroup ? styles.groupStart : styles.groupContinue} ${isSending ? styles.sending : ''}`}
                    >
                        {!isMyMessage && (
                            <div className={styles.avatarSlot}>
                                {shouldShowAvatar ? (
                                    <UserAvatar
                                        user={message.sender}
                                        name={senderName}
                                        className={styles.avatar}
                                    />
                                ) : (
                                    <div className={styles.avatarBlank} />
                                )}
                            </div>
                        )}

                        <div className={styles.messageStack}>
                            <Tooltip
                                title={formatFullTime(message.createdAt)}
                                placement={isMyMessage ? 'left' : 'right'}
                                mouseEnterDelay={0.35}
                            >
                                <div
                                    className={styles.bubble}
                                    tabIndex={0}
                                    aria-label={`${message.content}. Sent ${formatFullTime(message.createdAt)}`}
                                >
                                    {!isMyMessage && shouldShowAvatar && message.sender?.username && (
                                        <span className={styles.senderName}>{message.sender.username}</span>
                                    )}

                                    <p className={styles.content}>{message.content}</p>
                                </div>
                            </Tooltip>

                            {shouldShowMeta && (
                                <span className={styles.meta}>
                                    <span className={styles.time}>{formatMessageTime(message.createdAt)}</span>
                                    {myMessageStatus && <span className={styles.status}>{myMessageStatus}</span>}

                                    {isSending && (
                                        <span
                                            className={styles.sendingDot}
                                            title="Sending"
                                            aria-label="Sending"
                                        />
                                    )}

                                    {isFailed && (
                                        <span className={styles.failed}>
                                            Failed
                                            <button
                                                className={styles.retryBtn}
                                                onClick={() => onRetryMessage?.(message)}
                                                type="button"
                                            >
                                                Retry
                                            </button>
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}

            <div ref={messagesEndRef} />

            {remainingUnreadCount > 0 && (
                <button
                    className={styles.unreadJump}
                    onClick={handleJumpToUnread}
                    type="button"
                    aria-label={`${remainingUnreadCount} unread messages above`}
                >
                    <Badge count={remainingUnreadCount} overflowCount={99} size="small">
                        <span className={styles.unreadJumpIcon}>
                            <UpOutlined />
                        </span>
                    </Badge>
                </button>
            )}
        </div>
    );
}
