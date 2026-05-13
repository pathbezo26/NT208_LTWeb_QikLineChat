import { useEffect, useState } from 'react';
import { MessageOutlined } from '@ant-design/icons';
import { getMessagesAPI } from '../api/messageAPI';
import useSocket from '../hooks/useSocket';
import useAuth from '../hooks/useAuth';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import UserAvatar from './UserAvatar';
import styles from './styles/ChatWindow.module.css';

export default function ChatWindow({ conversation }) {
    const socket = useSocket();
    const { user } = useAuth();

    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);

    // 1. Tải lịch sử tin nhắn mỗi khi đổi conversation.
    useEffect(() => {
        // Nếu chưa chọn ai để chat thì dừng lại
        if (!conversation) return;
        // TẠO CỜ ĐÁNH DẤU: Mặc định là chưa hủy
        let ignore = false;
        // Định nghĩa hàm tải dữ liệu ngay trong useEffect 
        const fetchMessages = async () => {
            setIsLoading(true);

            try {
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

        // Làm sạch màn hình trước khi chuyển sang cuộc trò chuyện khác.
        setMessages([]);
        setTypingUsers([]);
        fetchMessages();

        return () => {
            ignore = true;
        };
    }, [conversation]); // Hàm này sẽ tự động chạy lại mỗi khi biến 'conversation' thay đổi

    // 2. Tham gia và rời khỏi Socket Room tương ứng với conversation hiện tại.
    useEffect(() => {
        if (!socket || !conversation) return;

        // Báo cho server biết mình vừa vào phòng này
        socket.emit('joinRoom', conversation._id);

        // Cleanup: Chạy khi component đóng hoặc khi nhảy sang chat với người khác
        return () => {
            socket.emit('leaveRoom', conversation._id);
        };
    }, [socket, conversation]);

    // 3. Lắng nghe tin nhắn mới từ socket và tránh thêm trùng message đã có.
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

        return () => socket.off('newMessage', handleNewMessage);
    }, [socket]);

    // 4. Lắng nghe trạng thái "đang nhập" của người khác trong room.
    useEffect(() => {
        if (!socket || !user) return;

        const handleUserTyping = ({ userId, username }) => {
            // Nếu chính mình gõ thì bỏ qua
            if (userId === user._id) return;

            setTypingUsers((prevUsers) => {
                // Nếu người này đã có trong danh sách đang gõ rồi thì không thêm nữa
                const isAlreadyTyping = prevUsers.find((typingUser) => typingUser.userId === userId);
                if (isAlreadyTyping) return prevUsers;

                // Cập nhật danh sách: giữ nguyên người cũ, thêm người mới vào
                return [...prevUsers, { userId, username }];
            });
        };

        const handleUserStopTyping = ({ userId }) => {
            setTypingUsers((prevUsers) => prevUsers.filter((typingUser) => typingUser.userId !== userId));
        };

        socket.on('typing', handleUserTyping);
        socket.on('stopTyping', handleUserStopTyping);

        return () => {
            socket.off('typing', handleUserTyping);
            socket.off('stopTyping', handleUserStopTyping);
        };
    }, [socket, user]);

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

    // Lấy thành viên còn lại trong private chat để hiển thị tên và avatar.
    const getOtherMember = () => {
        return conversation.members.find((member) => member._id !== user._id);
    };

    const getChatName = () => {
        if (conversation.type === 'group') {
            return conversation.name || 'Nhóm chat';
        }

        return getOtherMember()?.username || 'Người dùng';
    };

    return (
        <div className={styles.window}>
            <div className={styles.header}>
                <UserAvatar
                    user={conversation.type === 'private' ? getOtherMember() : null}
                    name={conversation.type === 'group' ? (conversation.name || 'Nhóm') : getChatName()}
                    className={styles.headerAvatar}
                    fallback={conversation.type === 'group' ? 'G' : '?'}
                />

                <div className={styles.headerInfo}>
                    <span className={styles.headerName}>{getChatName()}</span>
                    {conversation.type === 'group' && (
                        <span className={styles.memberCount}>
                            {conversation.members.length} thành viên
                        </span>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className={styles.loading}>Đang tải tin nhắn...</div>
            ) : (
                <MessageList messages={messages} currentUserId={user._id} />
            )}

            {typingUsers.length > 0 && (
                <div className={styles.typing}>
                    {typingUsers.map((typingUser) => typingUser.username).join(', ')} đang nhập...
                </div>
            )}

            <ChatInput conversationId={conversation._id} />
        </div>
    );
}
