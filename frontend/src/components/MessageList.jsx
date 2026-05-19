import { Fragment, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Badge, Dropdown, Modal } from 'antd';
import {
    CheckCircleOutlined,
    DeleteOutlined,
    DownloadOutlined,
    EllipsisOutlined,
    FileOutlined,
    InfoCircleOutlined,
    PushpinOutlined,
    ShareAltOutlined,
    SmileOutlined,
    UpOutlined,
} from '@ant-design/icons';
import { formatMessageTime, formatFullTime } from '../utils/formatTime';
import { normalizeDisplayFileName } from '../utils/fileNameEncoding';
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
const MESSAGE_TIME_DIVIDER_GAP_MS = 30 * 60 * 1000;
const LARGE_GROUP_MEMBER_COUNT = 20;
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const normalizeSearchText = (value = '') => {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase();
};

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

const hasMessageReference = (reference) => {
    return Boolean(reference?.messageId || reference?.content);
};

const formatFileSize = (size) => {
    if (!size) return '';
    if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getMessagePreviewContent = (message) => {
    const content = message?.content?.trim();
    if (content) return content;

    const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
    if (attachments.length === 0) return 'Message';

    const hasImage = attachments.some((attachment) => attachment.type === 'image');
    if (hasImage && attachments.length === 1) return 'Photo';
    if (hasImage) return `${attachments.length} attachments`;

    return attachments.length === 1 ? 'File' : `${attachments.length} files`;
};

const isSameCalendarDay = (firstMessage, secondMessage) => {
    if (!firstMessage || !secondMessage) return false;

    const firstDate = new Date(firstMessage.createdAt);
    const secondDate = new Date(secondMessage.createdAt);

    return firstDate.getFullYear() === secondDate.getFullYear()
        && firstDate.getMonth() === secondDate.getMonth()
        && firstDate.getDate() === secondDate.getDate();
};

const formatDividerTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));
    const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    if (diffDays === 0) return `Today ${time}`;
    if (diffDays === 1) return `Yesterday ${time}`;

    return `${date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} ${time}`;
};

const renderHighlightedContent = (content = '', searchTerm = '') => {
    const keyword = searchTerm.trim();
    if (!keyword) return content;

    const term = normalizeSearchText(keyword).trim();
    if (!term) return content;

    let normalizedContent = '';
    const indexMap = [];
    Array.from(content).forEach((char, originalIndex) => {
        const normalizedChar = normalizeSearchText(char);
        Array.from(normalizedChar).forEach((normalizedPart) => {
            normalizedContent += normalizedPart;
            indexMap.push(originalIndex);
        });
    });

    const ranges = [];
    let fromIndex = 0;
    while (fromIndex < normalizedContent.length) {
        const matchIndex = normalizedContent.indexOf(term, fromIndex);
        if (matchIndex < 0) break;

        const originalStart = indexMap[matchIndex];
        const originalEnd = (indexMap[matchIndex + term.length - 1] ?? originalStart) + 1;
        ranges.push([originalStart, originalEnd]);
        fromIndex = matchIndex + term.length;
    }

    const mergedRanges = ranges
        .sort((first, second) => first[0] - second[0])
        .reduce((items, range) => {
            const previous = items.at(-1);
            if (!previous || range[0] > previous[1]) return [...items, range];

            previous[1] = Math.max(previous[1], range[1]);
            return items;
        }, []);

    if (mergedRanges.length === 0) return content;

    const output = [];
    let cursor = 0;
    mergedRanges.forEach(([start, end], index) => {
        if (cursor < start) output.push(content.slice(cursor, start));
        output.push(
            <mark className={styles.searchHighlight} key={`${start}-${end}-${index}`}>
                {content.slice(start, end)}
            </mark>
        );
        cursor = end;
    });
    if (cursor < content.length) output.push(content.slice(cursor));

    return output;
};

export default function MessageList({
    messages,
    currentUserId,
    hasMore,
    conversationId,
    conversationType,
    initialUnreadCount,
    isInitialLoading,
    isLoadingOlder,
    conversationMembers = [],
    searchTerm = '',
    activeSearchMessageId = null,
    onLoadOlder,
    onRetryMessage,
    onReplyMessage,
    onForwardMessage,
    onDeleteMessage,
    onTogglePinMessage,
    onToggleReaction,
}) {
    const listRef = useRef(null);
    const messagesEndRef = useRef(null);
    const previousMessageCountRef = useRef(0);
    const previousLastMessageIdRef = useRef(null);
    const shouldStickToBottomRef = useRef(true);
    const preserveScrollRef = useRef(null);
    const unreadMessageRefs = useRef(new Map());
    const messageRefs = useRef(new Map());
    const seenUnreadMessageIdsRef = useRef(new Set());
    const unreadCount = initialUnreadCount || 0;
    const [remainingUnreadCount, setRemainingUnreadCount] = useState(unreadCount);
    const [infoMessage, setInfoMessage] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

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

    const setMessageRowRef = useCallback((messageId, node) => {
        if (!messageId) return;

        if (node) {
            messageRefs.current.set(messageId.toString(), node);
            return;
        }

        messageRefs.current.delete(messageId.toString());
    }, []);

    useLayoutEffect(() => {
        if (!activeSearchMessageId) return;

        const node = messageRefs.current.get(activeSearchMessageId.toString());
        if (!node) return;

        node.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });

        const bubble = node.querySelector(`.${styles.bubble}`);
        bubble?.focus({ preventScroll: true });
    }, [activeSearchMessageId, messages]);

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

        if (recipientIds.length === 0) return 'sent';

        const readCount = recipientIds.filter((memberId) => hasUserId(message.readBy, memberId)).length;
        if (readCount > 0) {
            return recipientIds.length === 1 ? 'read' : `read:${readCount}/${recipientIds.length}`;
        }

        const deliveredCount = recipientIds.filter((memberId) => hasUserId(message.deliveredTo, memberId)).length;
        if (deliveredCount > 0) {
            return 'delivered';
        }

        return 'sent';
    };

    const renderMessageStatus = (status) => {
        if (!status) return null;

        return (
            <span
                className={`${styles.statusIcon} ${status === 'delivered' ? styles.statusIconDouble : styles.statusIconSingle}`}
                aria-label={status === 'delivered' ? 'Delivered' : 'Sent'}
                title={status === 'delivered' ? 'Delivered' : 'Sent'}
            >
                {status === 'delivered' ? '✓✓' : '✓'}
            </span>
        );
    };

    const renderReadStatus = (status) => {
        if (!status?.startsWith('read')) return null;

        const [, count] = status.split(':');
        const label = count ? `Read ${count}` : 'Read';

        return <span className={styles.statusText}>{label}</span>;
    };

    const getInfoMessageStatusRows = (message) => {
        if (!message) return [];

        const recipientIds = (Array.isArray(conversationMembers) ? conversationMembers : [])
            .map(getUserId)
            .filter((memberId) => memberId && memberId !== getSenderId(message));
        const deliveredCount = recipientIds.filter((memberId) => hasUserId(message.deliveredTo, memberId)).length;
        const readCount = recipientIds.filter((memberId) => hasUserId(message.readBy, memberId)).length;
        const totalRecipients = recipientIds.length;
        const isMine = getSenderId(message) === currentUserId;

        const formatCount = (count) => {
            if (totalRecipients <= 1) return count > 0 ? '' : 'Waiting';
            return `${count}/${totalRecipients}`;
        };

        return [
            {
                key: 'sent',
                label: 'Sent',
                value: formatFullTime(message.createdAt),
                active: true,
            },
            {
                key: 'delivered',
                label: 'Delivered',
                value: totalRecipients === 0
                    ? ''
                    : isMine
                        ? formatCount(deliveredCount)
                        : hasUserId(message.deliveredTo, currentUserId) ? '' : 'Waiting',
                active: totalRecipients === 0 || (isMine ? deliveredCount > 0 : hasUserId(message.deliveredTo, currentUserId)),
            },
            {
                key: 'read',
                label: 'Read',
                value: totalRecipients === 0
                    ? ''
                    : isMine
                        ? formatCount(readCount)
                        : hasUserId(message.readBy, currentUserId) ? '' : 'Waiting',
                active: totalRecipients === 0 || (isMine ? readCount > 0 : hasUserId(message.readBy, currentUserId)),
            },
        ];
    };

    const getReferenceSenderName = (reference) => {
        return reference?.sender?.username || 'User';
    };

    const getReactionGroups = (reactions = []) => {
        if (!Array.isArray(reactions)) return [];

        return REACTION_EMOJIS
            .map((emoji) => {
                const items = reactions.filter((reaction) => reaction.emoji === emoji);
                return items.length > 0 ? { emoji, items } : null;
            })
            .filter(Boolean);
    };

    const hasMyReaction = (reactions = [], emoji) => {
        return reactions.some((reaction) => {
            return reaction.emoji === emoji && getUserId(reaction.user)?.toString() === currentUserId?.toString();
        });
    };

    const isLargeGroup = Array.isArray(conversationMembers) && conversationMembers.length >= LARGE_GROUP_MEMBER_COUNT;
    const isGroupConversation = conversationType === 'group';
    const lastOwnMessageIndex = messages.findLastIndex((message) => {
        return message?.type !== 'system' && getSenderId(message) === currentUserId;
    });

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
                const shouldShowTimeDivider = !previousMessage
                    || !isSameCalendarDay(previousMessage, message)
                    || Math.abs(getMessageTime(message) - getMessageTime(previousMessage)) > MESSAGE_TIME_DIVIDER_GAP_MS;
                const isLastInGroup = !isSameMessageGroup(message, nextMessage);
                const shouldShowAvatar = !isMyMessage && isFirstInGroup;
                const senderName = message.sender?.username || 'User';
                const isSending = isMyMessage && message.status === 'sending';
                const isFailed = isMyMessage && message.status === 'failed';
                const shouldShowOwnStatus = isMyMessage && index === lastOwnMessageIndex;
                const myMessageStatus = shouldShowOwnStatus && !isLargeGroup ? getMyMessageStatus(message) : '';
                const shouldShowMeta = isLastInGroup || isSending || isFailed;
                const shouldShowStatusMeta = Boolean(myMessageStatus || isSending || isFailed);
                const messageKey = getMessageKey(message);
                const firstUnreadIndex = Math.max(messages.length - unreadCount, 0);
                const isInitialUnreadMessage = unreadCount > 0 && index >= firstUnreadIndex;
                const attachments = Array.isArray(message.attachments) ? message.attachments : [];
                const imageAttachments = attachments.filter((attachment) => attachment.type === 'image');
                const fileAttachments = attachments.filter((attachment) => attachment.type !== 'image');
                const hasTextContent = Boolean(message.content);
                const hasReply = hasMessageReference(message.replyTo);
                const isDeletedForEveryone = Boolean(message.deletedForEveryone);
                const showsSenderName = isGroupConversation && !isMyMessage && shouldShowAvatar && message.sender?.username;
                const hasOnlyImages = imageAttachments.length > 0
                    && fileAttachments.length === 0
                    && !hasTextContent
                    && !hasReply
                    && !isDeletedForEveryone;
                const reactionGroups = getReactionGroups(message.reactions);
                const messageActionItems = [
                    {
                        key: 'info',
                        icon: <InfoCircleOutlined />,
                        label: 'Message info',
                    },
                    { type: 'divider' },
                    {
                        key: 'pin',
                        icon: <PushpinOutlined />,
                        label: message.isPinned ? 'Unpin message' : 'Pin message',
                    },
                    {
                        key: 'deleteForMe',
                        icon: <DeleteOutlined />,
                        label: 'Remove for me',
                    },
                    ...(isMyMessage ? [{
                        key: 'deleteForEveryone',
                        icon: <DeleteOutlined />,
                        label: 'Unsend message',
                        danger: true,
                    }] : []),
                ];
                const handleMessageActionClick = ({ key, domEvent }) => {
                    domEvent?.stopPropagation();

                    if (key === 'info') {
                        setInfoMessage(message);
                    }

                    if (key === 'pin') {
                        onTogglePinMessage?.(message);
                    }

                    if (key === 'deleteForMe') {
                        onDeleteMessage?.(message, 'me');
                    }

                    if (key === 'deleteForEveryone') {
                        onDeleteMessage?.(message, 'everyone');
                    }
                };

                return (
                    <Fragment key={messageKey || index}>
                    {shouldShowTimeDivider && (
                        <div className={styles.timeDivider} key={`divider-${messageKey || index}`}>
                            <span>{formatDividerTime(message.createdAt)}</span>
                        </div>
                    )}
                    {message.type === 'system' ? (
                        <div className={styles.systemMessage}>
                            <span>{message.content}</span>
                        </div>
                    ) : (
                    <div
                        ref={(node) => {
                            setMessageRowRef(messageKey, node);
                            if (isInitialUnreadMessage) {
                                setUnreadMessageRef(messageKey, node);
                            }
                        }}
                        className={`${styles.row} ${isMyMessage ? styles.own : styles.other} ${isFirstInGroup ? styles.groupStart : styles.groupContinue} ${isSending ? styles.sending : ''} ${activeSearchMessageId && messageKey?.toString() === activeSearchMessageId?.toString() ? styles.activeSearchMessage : ''}`}
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

                        <div className={`${styles.messageColumn} ${isMyMessage ? styles.ownColumn : styles.otherColumn}`}>
                            <div className={styles.messageStack}>
                                <div
                                    className={`${styles.bubble} ${hasOnlyImages ? styles.mediaOnlyBubble : ''}`}
                                    tabIndex={0}
                                    aria-label={`${getMessagePreviewContent(message)}. Sent ${formatFullTime(message.createdAt)}`}
                                >
                                    {showsSenderName && (
                                        <span className={styles.senderName}>{message.sender.username}</span>
                                    )}

                                    {message.isPinned && (
                                        <span className={styles.pinLabel}>
                                            <PushpinOutlined />
                                            Pinned
                                        </span>
                                    )}

                                {hasReply && (
                                    <div className={styles.replyBubble}>
                                        <span className={styles.replyAuthor}>
                                            {getReferenceSenderName(message.replyTo)}
                                        </span>
                                        <span className={styles.replyContent}>
                                            {message.replyTo.content || 'Attachment'}
                                        </span>
                                    </div>
                                )}

                                {imageAttachments.length > 0 && (
                                    <div
                                        className={`${styles.attachments} ${styles.imageGrid} ${imageAttachments.length === 1 ? styles.imageGridSingle : ''} ${imageAttachments.length > 1 ? styles.imageGridMulti : ''}`}
                                    >
                                        {imageAttachments.map((attachment, attachmentIndex) => (
                                                <button
                                                    className={styles.imageAttachment}
                                                    onClick={() => setPreviewImage(attachment)}
                                                    type="button"
                                                    key={`${attachment.url}-${attachmentIndex}`}
                                                    aria-label={`Preview ${normalizeDisplayFileName(attachment.name) || 'image attachment'}`}
                                                >
                                                    <img src={attachment.url} alt={normalizeDisplayFileName(attachment.name) || 'Image attachment'} />
                                                </button>
                                        ))}
                                    </div>
                                )}

                                {fileAttachments.length > 0 && (
                                    <div className={styles.attachments}>
                                        {fileAttachments.map((attachment, attachmentIndex) => (
                                                <a
                                                    className={styles.fileAttachment}
                                                    href={attachment.url || undefined}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    key={`${attachment.url}-${attachmentIndex}`}
                                                >
                                                    <span className={styles.fileIcon}>
                                                        <FileOutlined />
                                                    </span>
                                                    <span className={styles.fileInfo}>
                                                        <span className={styles.fileName}>{normalizeDisplayFileName(attachment.name) || 'Attachment'}</span>
                                                        <span className={styles.fileMeta}>
                                                            {attachment.mimeType || 'File'}{attachment.size ? ` - ${formatFileSize(attachment.size)}` : ''}
                                                        </span>
                                                    </span>
                                                </a>
                                        ))}
                                    </div>
                                )}

                                {isDeletedForEveryone ? (
                                    <p className={`${styles.content} ${styles.deletedContent}`}>Message deleted</p>
                                ) : (
                                    message.content && (
                                        <p className={styles.content}>
                                            {renderHighlightedContent(message.content, searchTerm)}
                                        </p>
                                    )
                                )}

                                {shouldShowMeta && (
                                <span className={styles.meta}>
                                    <span className={styles.time}>{formatMessageTime(message.createdAt)}</span>
                                </span>
                                )}
                                </div>

                                {!isSending && !isFailed && !isDeletedForEveryone && message._id && !String(message._id).startsWith('client-') && (
                                    <div className={styles.bubbleReaction} data-reaction-control>
                                        <button
                                            className={styles.bubbleReactionTrigger}
                                            onMouseDown={(event) => event.preventDefault()}
                                            type="button"
                                            aria-label="React to message"
                                        >
                                            <SmileOutlined />
                                        </button>
                                        <div className={styles.reactionPicker} aria-label="Reaction choices">
                                            {REACTION_EMOJIS.map((emoji) => (
                                                <button
                                                    key={emoji}
                                                    className={hasMyReaction(message.reactions, emoji) ? styles.reactionChoiceActive : ''}
                                                    type="button"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => onToggleReaction?.(message, emoji)}
                                                    aria-label={`React ${emoji}`}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!isSending && !isFailed && !isDeletedForEveryone && message._id && !String(message._id).startsWith('client-') && (
                                <div className={styles.messageActions} data-message-actions>
                                    <button
                                        className={styles.actionBtn}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => onReplyMessage?.(message)}
                                        type="button"
                                        aria-label="Reply to message"
                                    >
                                        <span className={styles.quoteIcon}>❞</span>
                                    </button>
                                    <button
                                        className={styles.actionBtn}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => onForwardMessage?.(message)}
                                        type="button"
                                        aria-label="Forward message"
                                    >
                                        <ShareAltOutlined />
                                    </button>
                                    <Dropdown
                                        menu={{
                                            items: messageActionItems,
                                            onClick: handleMessageActionClick,
                                        }}
                                        trigger={['click']}
                                        placement={isMyMessage ? 'bottomLeft' : 'bottomRight'}
                                        overlayClassName={styles.messageActionDropdown}
                                    >
                                        <button
                                            className={styles.actionBtn}
                                            onMouseDown={(event) => event.preventDefault()}
                                            type="button"
                                            aria-label="More message actions"
                                        >
                                            <EllipsisOutlined />
                                        </button>
                                    </Dropdown>
                                </div>
                                )}

                                {reactionGroups.length > 0 && (
                                    <div className={styles.reactionSummary}>
                                        {reactionGroups.map((group) => (
                                            <button
                                                key={group.emoji}
                                                className={hasMyReaction(message.reactions, group.emoji) ? styles.reactionSummaryActive : ''}
                                                type="button"
                                                onClick={() => onToggleReaction?.(message, group.emoji)}
                                                aria-label={`${group.items.length} reaction ${group.emoji}`}
                                            >
                                                <span>{group.emoji}</span>
                                                <strong>{group.items.length}</strong>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {shouldShowStatusMeta && (
                                <span className={styles.statusMeta}>
                                    {myMessageStatus?.startsWith('read')
                                        ? renderReadStatus(myMessageStatus)
                                        : renderMessageStatus(myMessageStatus)}

                                    {isSending && (
                                        <span
                                            className={styles.sendingDot}
                                            title="Sending"
                                            aria-label="Sending"
                                        />
                                    )}

                                    {isFailed && (
                                        <span className={styles.failed}>
                                            {message.errorMessage || 'Failed'}
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
                    </div>
                    )}
                    </Fragment>
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

            <Modal
                open={Boolean(infoMessage)}
                onCancel={() => setInfoMessage(null)}
                footer={null}
                centered
                width={390}
                className={styles.infoModal}
            >
                {infoMessage && (
                    <div className={styles.infoModalContent}>
                        <div className={styles.infoModalHeader}>
                            <span className={styles.infoModalIcon}>
                                <InfoCircleOutlined />
                            </span>
                            <div>
                                <h3>Message info</h3>
                                <p>{getMessagePreviewContent(infoMessage)}</p>
                            </div>
                        </div>

                        <div className={styles.infoStatusList}>
                            {getInfoMessageStatusRows(infoMessage).map((item) => (
                                <div className={`${styles.infoStatusRow} ${item.active ? styles.infoStatusActive : ''}`} key={item.key}>
                                    <span className={styles.infoStatusIcon}>
                                        <CheckCircleOutlined />
                                    </span>
                                    <span className={styles.infoStatusLabel}>{item.label}</span>
                                    {item.value && <strong>{item.value}</strong>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                open={Boolean(previewImage)}
                onCancel={() => setPreviewImage(null)}
                footer={null}
                centered
                width="min(960px, calc(100vw - 32px))"
                className={styles.imagePreviewModal}
            >
                {previewImage && (
                    <div className={styles.imagePreviewContent}>
                        <div className={styles.imagePreviewStage}>
                        <img src={previewImage.url} alt={normalizeDisplayFileName(previewImage.name) || 'Image preview'} />
                        </div>
                        <div className={styles.imagePreviewMeta}>
                            <span>{normalizeDisplayFileName(previewImage.name) || 'Image attachment'}</span>
                            {previewImage.url && (
                                <a href={previewImage.url} target="_blank" rel="noreferrer">
                                    <DownloadOutlined />
                                    Open original
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
