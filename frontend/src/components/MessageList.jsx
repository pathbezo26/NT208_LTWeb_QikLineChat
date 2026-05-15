import { useCallback, useLayoutEffect, useRef } from 'react';
import { formatMessageTime, formatFullTime } from '../utils/formatTime';
import UserAvatar from './UserAvatar';
import styles from './styles/MessageList.module.css';

const getSenderId = (message) => {
    return typeof message.sender === 'object' ? message.sender._id : message.sender;
};

const SCROLL_TOP_THRESHOLD = 80;
const SCROLL_BOTTOM_THRESHOLD = 120;

export default function MessageList({
    messages,
    currentUserId,
    hasMore,
    isInitialLoading,
    isLoadingOlder,
    onLoadOlder,
    onRetryMessage,
}) {
    const listRef = useRef(null);
    const messagesEndRef = useRef(null);
    const previousMessageCountRef = useRef(0);
    const previousLastMessageIdRef = useRef(null);
    const shouldStickToBottomRef = useRef(true);
    const preserveScrollRef = useRef(null);

    const isNearBottom = useCallback(() => {
        const list = listRef.current;
        if (!list) return true;

        return list.scrollHeight - list.scrollTop - list.clientHeight < SCROLL_BOTTOM_THRESHOLD;
    }, []);

    const handleScroll = useCallback(() => {
        const list = listRef.current;
        if (!list) return;

        shouldStickToBottomRef.current = isNearBottom();

        if (list.scrollTop > SCROLL_TOP_THRESHOLD || !hasMore || isLoadingOlder || !onLoadOlder) return;

        preserveScrollRef.current = {
            height: list.scrollHeight,
            top: list.scrollTop,
        };
        onLoadOlder();
    }, [hasMore, isLoadingOlder, isNearBottom, onLoadOlder]);

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

        previousMessageCountRef.current = messages.length;
        previousLastMessageIdRef.current = lastMessageId;
    }, [messages]);

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
                const previousSenderId = previousMessage ? getSenderId(previousMessage) : null;
                const isFirstInGroup = previousSenderId !== senderId;
                const shouldShowAvatar = !isMyMessage && isFirstInGroup;
                const senderName = message.sender?.username || 'User';
                const isSending = isMyMessage && message.status === 'sending';
                const isFailed = isMyMessage && message.status === 'failed';

                return (
                    <div
                        key={message._id || index}
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

                        <div className={styles.bubble} title={formatFullTime(message.createdAt)}>
                            {!isMyMessage && shouldShowAvatar && message.sender?.username && (
                                <span className={styles.senderName}>{message.sender.username}</span>
                            )}

                            <p className={styles.content}>{message.content}</p>
                            <span className={styles.meta}>
                                <span className={styles.time}>{formatMessageTime(message.createdAt)}</span>

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
                        </div>
                    </div>
                );
            })}

            <div ref={messagesEndRef} />
        </div>
    );
}
