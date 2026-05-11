import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import styles from './styles/ChatPage.module.css';

export default function ChatPage() {
    const [activeConversation, setActiveConversation] = useState(null);

    // --- HÀM XỬ LÝ TÌM KIẾM NGAY TRÊN SIDEBAR ---
    const handleSearchInput = async (e) => {
        const value = e.target.value;
        setSearchTerm(value);

        if (!value.trim()) {
            setIsSearching(false);
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // Gọi backend tìm kiếm
            const data = await searchUsersAPI(value);
            setSearchResults(data.users || data || []);
        } catch (error) {
            console.error("Lỗi tìm kiếm:", error);
        }
    };

    // --- HÀM KHI CLICK VÀO NGƯỜI TÌM THẤY ---
    const handleSelectSearchedUser = async (userId) => {
        try {
            const res = await createConversationAPI({
                type: 'private',
                members: [userId]
            });
            if (res && res.conversation) {
                handleNewConversation(res.conversation);
                // Trả UI về trạng thái bình thường (tắt tìm kiếm)
                setSearchTerm('');
                setIsSearching(false);
                setSearchResults([]);
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Lỗi tạo cuộc trò chuyện');
        }
    };

    // HÀM KHI NHẬN ĐƯỢC SỰ KIỆN XÓA CUỘC TRÒ CHUYỆN
    const handleConversationDeleted = () => {
        // Xóa cuộc hội thoại đang active để màn hình ChatWindow trở về trạng thái trống
        setActiveConversation(null);
    };

    return (
        <div className={styles.layout}>
            <Sidebar
                activeConversation={activeConversation}
                onSelectConversation={setActiveConversation}
                onConversationDeleted={handleConversationDeleted}
            />
            <ChatWindow conversation={activeConversation} />
        </div>
    );
}
