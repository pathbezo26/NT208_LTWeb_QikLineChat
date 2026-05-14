import { useEffect, useRef } from 'react';
import { formatMessageTime, formatFullTime } from '../utils/formatTime';
import UserAvatar from './UserAvatar';
import styles from './styles/MessageList.module.css';

const getSenderId = (message) => {
    return typeof message.sender === 'object' ? message.sender._id : message.sender;
};

export default function MessageList({ messages, currentUserId }) {
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!messages || messages.length === 0) {
        return (
            <div className={styles.empty}>
                <p>Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!</p>
            </div>
        );
    }

    return (
        <div className={styles.list}>
            {messages.map((message, index) => {
                const senderId = getSenderId(message);
                const isMyMessage = senderId === currentUserId;
                const previousMessage = messages[index - 1];
                const previousSenderId = previousMessage ? getSenderId(previousMessage) : null;
                const isFirstInGroup = previousSenderId !== senderId;
                const shouldShowAvatar = !isMyMessage && isFirstInGroup;
                const senderName = message.sender?.username || 'Người dùng';

                return (
                    <div
                        key={message._id || index}
                        className={`${styles.row} ${isMyMessage ? styles.own : styles.other} ${isFirstInGroup ? styles.groupStart : styles.groupContinue}`}
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
                            <span className={styles.time}>{formatMessageTime(message.createdAt)}</span>
                        </div>
                    </div>
                );
            })}

            <div ref={messagesEndRef} />
        </div>
    );
}
