import { useEffect, useRef } from 'react';
import { formatMessageTime, formatFullTime } from '../utils/formatTime';
import styles from './styles/MessageList.module.css';

export default function MessageList({ messages, currentUserId }) {
    // Đổi tên ref cho rõ nghĩa: Đây là điểm cuối cùng của danh sách tin nhắn
    const messagesEndRef = useRef(null);

    // 1. Tự động cuộn xuống tin nhắn mới nhất mỗi khi mảng messages thay đổi
    useEffect(() => {
        // Dấu ?. giúp tránh lỗi nếu thẻ div chưa kịp render (còn đang là null)
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 2. Giao diện trạng thái trống (Chưa có tin nhắn)
    if (!messages || messages.length === 0) {
        return (
            <div className={styles.empty}>
                <p>Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện! 👋</p>
            </div>
        );
    }

    // 3. Render danh sách tin nhắn
    return (
        <div className={styles.list}>
            {messages.map((message, index) => {
                // --- XỬ LÝ DỮ LIỆU ĐẦU VÀO ---
                // Tùy cách backend viết (có dùng .populate() hay không), sender có thể là 1 Object hoặc 1 chuỗi ID.
                // Ta thống nhất lấy ra chuỗi ID để dễ so sánh.
                const senderId = typeof message.sender === 'object' ? message.sender._id : message.sender;

                // Tin nhắn này có phải do chính mình gửi không?
                const isMyMessage = senderId === currentUserId;

                // --- LOGIC HIỂN THỊ AVATAR ---
                // Quy tắc: Chỉ hiện Avatar cho tin nhắn của NGƯỜI KHÁC.
                // Nếu một người nhắn liên tiếp 3 tin, ta chỉ hiện Avatar ở tin nhắn ĐẦU TIÊN của người đó.
                let shouldShowAvatar = false;

                if (!isMyMessage) {
                    if (index === 0) {
                        // Nếu đây là tin nhắn đầu tiên của cả đoạn chat -> Chắc chắn phải hiện
                        shouldShowAvatar = true;
                    } else {
                        // Lấy tin nhắn liền kề trước đó ra để kiểm tra
                        const previousMessage = messages[index - 1];
                        const previousSenderId = typeof previousMessage.sender === 'object'
                            ? previousMessage.sender._id
                            : previousMessage.sender;

                        // Nếu người nhắn tin trước KHÁC với người nhắn tin này -> Hiện Avatar
                        if (previousSenderId !== senderId) {
                            shouldShowAvatar = true;
                        }
                    }
                }

                // Lấy tên người gửi và cắt chữ cái đầu tiên (VD: "Nam" -> "N")
                const senderName = message.sender?.username || 'Người dùng';
                const firstLetter = senderName.charAt(0).toUpperCase();

                return (
                    <div
                        key={message._id || index} // Dùng _id làm key là chuẩn nhất
                        className={`${styles.row} ${isMyMessage ? styles.own : styles.other}`}
                    >
                        {/* Cột hiển thị Avatar bên trái (Chỉ dành cho tin nhắn của người khác) */}
                        {!isMyMessage && (
                            <div className={styles.avatarSlot}>
                                {shouldShowAvatar ? (
                                    <div className={styles.avatar} title={senderName}>
                                        {firstLetter}
                                    </div>
                                ) : (
                                    // Thẻ div trống (tàng hình) để giữ chỗ, giúp các bong bóng chat thẳng hàng nhau
                                    <div className={styles.avatarBlank} />
                                )}
                            </div>
                        )}

                        {/* Khung chứa nội dung tin nhắn (Bong bóng chat) */}
                        <div className={styles.bubble} title={formatFullTime(message.createdAt)}>

                            {/* Hiện tên người gửi ở ngay trên tin nhắn đầu tiên của họ */}
                            {!isMyMessage && shouldShowAvatar && message.sender?.username && (
                                <span className={styles.senderName}>{message.sender.username}</span>
                            )}

                            {/* Nội dung chính */}
                            <p className={styles.content}>{message.content}</p>

                            {/* Thời gian gửi (VD: 10:30) */}
                            <span className={styles.time}>{formatMessageTime(message.createdAt)}</span>
                        </div>
                    </div>
                );
            })}

            {/* Một thẻ div tàng hình nằm ở cuối danh sách để làm "mục tiêu" cho hàm scrollIntoView cuộn tới */}
            <div ref={messagesEndRef} />
        </div>
    );
}