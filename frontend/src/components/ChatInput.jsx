import { useCallback, useRef, useState } from 'react';
import { SendOutlined } from '@ant-design/icons';
import useSocket from '../hooks/useSocket';
import styles from './styles/ChatInput.module.css';

const MAX_MESSAGE_LENGTH = 5000;

export default function ChatInput({ conversationId, onSendMessage }) {
    const socket = useSocket();

    const [message, setMessage] = useState('');
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    const stopTyping = useCallback(() => {
        if (!socket) return;

        clearTimeout(typingTimeoutRef.current);
        isTypingRef.current = false;
        socket.emit('stopTyping', { conversationId });
    }, [socket, conversationId]);

    const handleTypingIndicator = useCallback(() => {
        if (!socket) return;

        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socket.emit('typing', { conversationId });
        }

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(stopTyping, 1500);
    }, [socket, conversationId, stopTyping]);

    const handleChange = (e) => {
        const nextMessage = e.target.value.slice(0, MAX_MESSAGE_LENGTH);

        setMessage(nextMessage);
        handleTypingIndicator();
    };

    const handleSend = () => {
        const content = message.trim();
        if (!content || !socket || !onSendMessage) return;

        onSendMessage(content);
        setMessage('');
        stopTyping();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={styles.inputBar}>
            <textarea
                className={styles.textarea}
                maxLength={MAX_MESSAGE_LENGTH}
                value={message}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message"
                rows={1}
            />

            <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!message.trim()}
                title="Send message"
                aria-label="Send message"
                type="button"
            >
                <SendOutlined />
            </button>
            <span className={styles.counter}>
                {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
        </div>
    );
}
