import { useEffect, useState } from 'react';
import { getMessagesAPI } from '../api/messageAPI';
import useSocket from '../hooks/useSocket';
import useAuth from '../hooks/useAuth';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { MessageOutlined } from '@ant-design/icons';
import styles from './styles/ChatWindow.module.css';

export default function ChatWindow({ conversation }) {
    const socket = useSocket();
    const { user } = useAuth();

    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);

    // 1. Tải lịch sử tin nhắn mỗi khi đổi người chat (đổi conversation)
    useEffect(() => {
        // Nếu chưa chọn ai để chat thì dừng lại
        if (!conversation) return;
        // TẠO CỜ ĐÁNH DẤU: Mặc định là chưa hủy
        let ignore = false;
        // Định nghĩa hàm tải dữ liệu ngay trong useEffect cho dễ quản lý
        const fetchMessages = async () => {
            setIsLoading(true);
            try {
                // Gọi API: (Lưu ý đã bỏ .data vì messageAPI đã xử lý)
                const data = await getMessagesAPI(conversation._id);
                // KIỂM TRA TRƯỚC KHI CẬP NHẬT: 
                // Nếu người dùng chưa chuyển sang phòng khác thì mới set State
                if (!ignore) {
                    setMessages(data);
                }
            } catch (error) {
                console.error('Lỗi khi tải tin nhắn:', error);
            } finally {
                // Tương tự, nếu chưa chuyển phòng thì mới tắt Loading
                if (!ignore) setIsLoading(false);
            }
        };

        // Làm sạch màn hình trước khi tải tin nhắn của người mới
        setMessages([]);
        setTypingUsers([]);

        // Bắt đầu tải
        fetchMessages();

    }, [conversation]); // Hàm này sẽ tự động chạy lại mỗi khi biến 'conversation' thay đổi

    // 2. Xử lý tham gia và rời khỏi phòng chat (Socket Room)
    useEffect(() => {
        if (!socket || !conversation) return;

        // Báo cho server biết mình vừa vào phòng này
        socket.emit('joinRoom', conversation._id);

        // Cleanup: Chạy khi component đóng hoặc khi nhảy sang chat với người khác
        return () => {
            socket.emit('leaveRoom', conversation._id);
        };
    }, [socket, conversation]);

    // 3. Lắng nghe tin nhắn mới từ người khác gửi tới
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (newMessage) => {
            setMessages((prevMessages) => {
                // Kiểm tra xem tin nhắn đã có trong danh sách chưa (tránh bị lặp lại)
                const isMessageExist = prevMessages.find((msg) => msg._id === newMessage._id);
                if (isMessageExist) return prevMessages;

                // Nếu chưa có thì thêm vào cuối mảng tin nhắn
                return [...prevMessages, newMessage];
            });
        };

        socket.on('newMessage', handleNewMessage);

        // Cleanup: Ngắt lắng nghe khi component đóng
        return () => socket.off('newMessage', handleNewMessage);
    }, [socket]);

    // 4. Lắng nghe hiệu ứng "ai đó đang gõ..."
    useEffect(() => {
        if (!socket || !user) return;

        const handleUserTyping = ({ userId, username }) => {
            // Nếu chính mình gõ thì bỏ qua
            if (userId === user._id) return;

            setTypingUsers((prevUsers) => {
                // Nếu người này đã có trong danh sách đang gõ rồi thì không thêm nữa
                const isAlreadyTyping = prevUsers.find((u) => u.userId === userId);
                if (isAlreadyTyping) return prevUsers;

                // Cập nhật danh sách: giữ nguyên người cũ, thêm người mới vào
                return [...prevUsers, { userId, username }];
            });
        };

        const handleUserStopTyping = ({ userId }) => {
            // Lọc bỏ người dùng đã ngừng gõ ra khỏi danh sách
            setTypingUsers((prevUsers) => prevUsers.filter((u) => u.userId !== userId));
        };

        socket.on('typing', handleUserTyping);
        socket.on('stopTyping', handleUserStopTyping);

        return () => {
            socket.off('typing', handleUserTyping);
            socket.off('stopTyping', handleUserStopTyping);
        };
    }, [socket, user]);

    // --- PHẦN RENDER GIAO DIỆN ---

    // Giao diện khi mới vào web, chưa chọn ai để chat
    if (!conversation) {
        return (
            <div className={styles.empty}>
                <div className={styles.emptyIcon}>
                    <MessageOutlined />
                </div>
                <p>Chọn một cuộc trò chuyện để bắt đầu</p>
                <span>Nhắn tin riêng tư hoặc tạo nhóm để trò chuyện cùng bạn bè.</span>
            </div>
        );
    }

    // Hàm phụ giúp lấy tên hiển thị (Tên nhóm hoặc tên người đối diện)
    const getChatName = () => {
        if (conversation.type === 'group') {
            return conversation.name || 'Nhóm chat';
        }

        // Chat cá nhân: Tìm thành viên không phải là mình
        const otherMember = conversation.members.find((member) => member._id !== user._id);
        return otherMember?.username || 'Người dùng';
    };

    return (
        <div className={styles.window}>
            {/* Phần tiêu đề phía trên */}
            <div className={styles.header}>
                <div className={styles.headerAvatar}>
                    {conversation.type === 'group' ? '👥' : getChatName().charAt(0).toUpperCase()}
                </div>
                <div className={styles.headerInfo}>
                    <span className={styles.headerName}>{getChatName()}</span>
                    {conversation.type === 'group' && (
                        <span className={styles.memberCount}>
                            {conversation.members.length} thành viên
                        </span>
                    )}
                </div>
            </div>

            {/* Phần danh sách tin nhắn ở giữa */}
            {isLoading ? (
                <div className={styles.loading}>Đang tải tin nhắn...</div>
            ) : (
                <MessageList messages={messages} currentUserId={user._id} />
            )}

            {/* Hiển thị dòng chữ "Nguyễn Văn A đang nhập..." */}
            {typingUsers.length > 0 && (
                <div className={styles.typing}>
                    {typingUsers.map((u) => u.username).join(', ')} đang nhập...
                </div>
            )}

            {/* Khung nhập tin nhắn phía dưới cùng */}
            <ChatInput conversationId={conversation._id} />
        </div>
    );
}
