import { useCallback, useEffect, useRef, useState } from 'react';
import { CloseOutlined, FileOutlined, PaperClipOutlined, SendOutlined } from '@ant-design/icons';
import useSocket from '../hooks/useSocket';
import styles from './styles/ChatInput.module.css';

const MAX_MESSAGE_LENGTH = 5000;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const formatFileSize = (size) => {
    if (!size) return '0 KB';
    if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export default function ChatInput({ conversationId, onSendMessage, replyToMessage, onCancelReply, disabled = false, disabledReason = '' }) {
    const socket = useSocket();

    const [message, setMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [attachmentError, setAttachmentError] = useState('');
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);
    const fileInputRef = useRef(null);
    const selectedFilesRef = useRef([]);

    useEffect(() => {
        selectedFilesRef.current = selectedFiles;
    }, [selectedFiles]);

    useEffect(() => {
        return () => {
            selectedFilesRef.current.forEach((item) => {
                if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            });
        };
    }, []);

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

    const handlePickFiles = (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';

        if (files.length === 0) return;

        setAttachmentError('');
        setSelectedFiles((currentFiles) => {
            const remainingSlots = MAX_ATTACHMENTS - currentFiles.length;
            const acceptedFiles = files.slice(0, Math.max(remainingSlots, 0));
            const oversizedFile = acceptedFiles.find((file) => file.size > MAX_ATTACHMENT_SIZE);

            if (remainingSlots <= 0) {
                setAttachmentError(`You can attach up to ${MAX_ATTACHMENTS} files.`);
                return currentFiles;
            }

            if (files.length > remainingSlots) {
                setAttachmentError(`Only ${remainingSlots} more file${remainingSlots === 1 ? '' : 's'} can be attached.`);
            }

            if (oversizedFile) {
                setAttachmentError('Each attachment must not exceed 10MB.');
                return currentFiles;
            }

            return [
                ...currentFiles,
                ...acceptedFiles.map((file) => ({
                    file,
                    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
                })),
            ];
        });
    };

    const handleRemoveFile = (indexToRemove) => {
        setSelectedFiles((currentFiles) => {
            const fileToRemove = currentFiles[indexToRemove];
            if (fileToRemove?.previewUrl) URL.revokeObjectURL(fileToRemove.previewUrl);

            return currentFiles.filter((_, index) => index !== indexToRemove);
        });
    };

    const handleSend = () => {
        const content = message.trim();
        if (disabled || (!content && selectedFiles.length === 0) || !socket || !onSendMessage) return;

        setAttachmentError('');
        onSendMessage(content, null, {
            ...(replyToMessage ? { replyToMessage } : {}),
            attachments: selectedFiles.map((item) => ({
                type: item.file.type.startsWith('image/') ? 'image' : 'file',
                url: item.previewUrl,
                publicId: '',
                name: item.file.name,
                size: item.file.size,
                mimeType: item.file.type,
                width: null,
                height: null,
            })),
            files: selectedFiles.map((item) => item.file),
        });
        setMessage('');
        setSelectedFiles([]);
        stopTyping();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={styles.inputWrap}>
            {replyToMessage && (
                <div className={styles.replyPreview}>
                    <div className={styles.replyText}>
                        <span className={styles.replyLabel}>
                            Replying to {replyToMessage.sender?.username || 'User'}
                        </span>
                        <span className={styles.replyContent}>{replyToMessage.content}</span>
                    </div>
                    <button
                        className={styles.cancelReplyBtn}
                        onClick={onCancelReply}
                        type="button"
                        title="Cancel reply"
                        aria-label="Cancel reply"
                    >
                        <CloseOutlined />
                    </button>
                </div>
            )}
            {selectedFiles.length > 0 && (
                <div className={styles.attachmentTray}>
                    {selectedFiles.map((item, index) => (
                        <div className={styles.attachmentChip} key={`${item.file.name}-${item.file.size}-${index}`}>
                            {item.previewUrl ? (
                                <img src={item.previewUrl} alt="" className={styles.attachmentThumb} />
                            ) : (
                                <span className={styles.fileThumb}>
                                    <FileOutlined />
                                </span>
                            )}
                            <span className={styles.attachmentInfo}>
                                <span className={styles.attachmentName}>{item.file.name}</span>
                                <span className={styles.attachmentSize}>{formatFileSize(item.file.size)}</span>
                            </span>
                            <button
                                className={styles.removeAttachmentBtn}
                                onClick={() => handleRemoveFile(index)}
                                type="button"
                                title="Remove attachment"
                                aria-label="Remove attachment"
                            >
                                <CloseOutlined />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {attachmentError && <div className={styles.attachmentError}>{attachmentError}</div>}
            {disabled && (
                <div className={styles.disabledOverlay}>
                    <span className={styles.disabledIcon}>!</span>
                    <span>{disabledReason || 'Messaging is disabled'}</span>
                </div>
            )}
            <div className={styles.inputBar}>
            <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                multiple
                onChange={handlePickFiles}
                disabled={disabled}
            />
            <button
                className={styles.attachBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || selectedFiles.length >= MAX_ATTACHMENTS}
                title="Attach file"
                aria-label="Attach file"
                type="button"
            >
                <PaperClipOutlined />
            </button>
            <textarea
                className={styles.textarea}
                maxLength={MAX_MESSAGE_LENGTH}
                value={message}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder={selectedFiles.length > 0 ? 'Add a message' : 'Type a message'}
                rows={1}
            />

            <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={disabled || (!message.trim() && selectedFiles.length === 0)}
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
        </div>
    );
}
