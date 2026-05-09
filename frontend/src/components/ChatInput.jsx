import { useState, useRef, useCallback } from 'react';
import useSocket from '../hooks/useSocket';
import styles from './styles/ChatInput.module.css';

export default function ChatInput({ conversationId }) {
    const socket = useSocket();

    // Đổi tên biến 'text' thành 'message' cho rõ ngữ nghĩa hơn
    const [message, setMessage] = useState('');

    // Dùng để lưu trữ timeout và trạng thái gõ, không làm component re-render
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    // Logic xử lý hiệu ứng "Đang gõ..." (Typing Indicator)
    const handleTypingIndicator = useCallback(() => {
        if (!socket) return;

        // 1. Nếu chưa ở trạng thái typing thì báo cho server biết mình đang gõ
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socket.emit('typing', { conversationId });
        }

        // 2. Xóa bộ đếm cũ mỗi khi có ký tự mới được nhập vào
        clearTimeout(typingTimeoutRef.current);

        // 3. Đặt bộ đếm mới: Nếu ngừng gõ quá 1.5 giây -> Báo server là ngừng gõ
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
            socket.emit('stopTyping', { conversationId });
        }, 1500);
    }, [socket, conversationId]);

    // Khi người dùng gõ phím
    const handleChange = (e) => {
        setMessage(e.target.value);
        handleTypingIndicator();
    };

    // Khi bấm nút Gửi
    const handleSend = () => {
        const content = message.trim();
        if (!content || !socket) return;

        // Gửi tin nhắn đi qua Socket
        socket.emit('sendMessage', { conversationId, content });

        // Reset lại ô nhập liệu
        setMessage('');

        // Dọn dẹp ngay hiệu ứng "đang gõ..." vì tin nhắn đã bay đi rồi
        clearTimeout(typingTimeoutRef.current);
        isTypingRef.current = false;
        socket.emit('stopTyping', { conversationId });

        // LƯU Ý: Nếu sau này bạn muốn kết hợp gọi hàm sendMessageAPI({ conversationId, content }) 
        // để lưu thẳng vào DB (như đã bàn ở file api), bạn sẽ gọi nó ở ngay đây!
    };

    // Hỗ trợ phím tắt gửi tin nhắn
    const handleKeyDown = (e) => {
        // Nếu bấm Enter và KHÔNG giữ nút Shift
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Chặn hành vi tự động nhảy xuống dòng của textarea
            handleSend();
        }
    };

    return (
        <div className={styles.inputBar}>
            <textarea
                className={styles.textarea}
                value={message}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter xuống dòng)"
                rows={1}
            />

            <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!message.trim()} // Vô hiệu hóa nút nếu chỉ có khoảng trắng
                title="Gửi tin nhắn"
            >
                ➤
            </button>
        </div>
    );
}