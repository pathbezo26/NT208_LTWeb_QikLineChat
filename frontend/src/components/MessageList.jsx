import { useEffect, useRef } from 'react';
import { formatTime, formatFullTime } from '../utils/formatTime';
import useAuth from '../hooks/useAuth';
import './styles/MessageList.css';

// Props:
// messages — mảng tin nhắn [{ _id, sender: {_id, username}, content, createdAt }]
function MessageList({ messages }) {
    const { user } = useAuth();

    // Ref để tự động cuộn xuống tin nhắn mới nhất
    const bottomRef = useRef(null);

    // Mỗi khi messages thay đổi (có tin mới) → cuộn xuống cuối
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="message-empty">
                <span>💬</span>
                <p>Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!</p>
            </div>
        );
    }

    return (
        <div className="message-list">
            {messages.map((msg) => {
                // Kiểm tra tin nhắn này có phải do mình gửi không
                const isMine = msg.sender._id === user._id;

                return (
                    <div
                        key={msg._id}
                        className={`message-row ${isMine ? 'mine' : 'theirs'}`}
                    >
                        {/* Avatar — chỉ hiển thị với tin nhắn của người khác */}
                        {!isMine && (
                            <div className="message-avatar" title={msg.sender.username}>
                                {msg.sender.username.charAt(0).toUpperCase()}
                            </div>
                        )}

                        <div className="message-content-wrapper">
                            {/* Tên người gửi — chỉ hiển thị với tin nhắn của người khác */}
                            {!isMine && (
                                <span className="message-sender-name">{msg.sender.username}</span>
                            )}

                            {/* Bubble chứa nội dung tin nhắn */}
                            <div
                                className={`message-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}`}
                                title={formatFullTime(msg.createdAt)} // Tooltip thời gian đầy đủ khi hover
                            >
                                {msg.content}
                            </div>

                            {/* Thời gian gửi */}
                            <span className="message-time">{formatTime(msg.createdAt)}</span>
                        </div>
                    </div>
                );
            })}

            {/* Phần tử ẩn ở cuối danh sách — dùng để auto scroll */}
            <div ref={bottomRef} />
        </div>
    );
}

export default MessageList;
