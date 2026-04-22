import { useState } from 'react';
import './styles/ChatInput.css';

// Props:
// onSend(content) — hàm gọi khi người dùng nhấn gửi
// disabled        — khoá input khi chưa chọn conversation
function ChatInput({ onSend, disabled }) {
    const [text, setText] = useState('');

    const handleSend = () => {
        // Không gửi nếu chỉ có khoảng trắng
        if (!text.trim()) return;
        onSend(text.trim());
        setText(''); // Xóa ô input sau khi gửi
    };

    // Nhấn Enter → gửi, Shift+Enter → xuống dòng
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-input-bar">
            <textarea
                className="chat-input-field"
                placeholder={disabled ? 'Chọn một cuộc trò chuyện...' : 'Nhập tin nhắn...'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                rows={1}
            />
            <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={disabled || !text.trim()}
                title="Gửi tin nhắn (Enter)"
            >
                {/* Icon gửi dạng SVG — không cần cài thêm thư viện icon */}
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
            </button>
        </div>
    );
}

export default ChatInput;
