import { useEffect, useState } from 'react';
import { getConversationsAPI, deleteConversationAPI } from '../api/conversationAPI';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import UserSearch from './UserSearch';
import CreateGroupModal from './CreateGroupModal';
import { formatMessageTime } from '../utils/formatTime';
import styles from './styles/Sidebar.module.css';

export default function Sidebar({ activeConversation, onSelectConversation }) {
    const { user } = useAuth();
    const socket = useSocket();

    const [conversations, setConversations] = useState([]);

    // Trạng thái bật/tắt các khung tìm kiếm và tạo nhóm
    const [showSearch, setShowSearch] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);

    // State quản lý menu 3 chấm và xác nhận xóa hội thoại
    const [openMenuId, setOpenMenuId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    // Click ra ngoài để đóng menu 3 chấm và hộp xác nhận xóa
    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null);
            setDeleteConfirmId(null);
        };

        // Gắn sự kiện click vào toàn bộ trang
        document.addEventListener('click', handleClickOutside);

        // Dọn dẹp sự kiện khi component đóng lại
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    // 1. Hàm tải danh sách các cuộc trò chuyện từ Server
    const loadConversations = async () => {
        try {
            // API trả về thẳng danh sách conversation
            const data = await getConversationsAPI();
            setConversations(data);
        } catch (error) {
            console.error('Lỗi khi tải danh sách cuộc trò chuyện:', error);
        }
    };

    // Chạy 1 lần duy nhất khi vừa mở Sidebar lên
    useEffect(() => {
        loadConversations();
    }, []);

    // 2. Lắng nghe tin nhắn mới từ Socket để sắp xếp lại danh sách Sidebar
    useEffect(() => {
        if (!socket) return;

        // Khi có người nhắn tin đến, gọi lại API để cập nhật tin mới nhất
        // và đẩy phòng chat đó lên đầu danh sách.
        const handleNewMessage = () => {
            loadConversations();
        };

        socket.on('newMessage', handleNewMessage);

        // Dọn dẹp listener khi component bị đóng
        return () => socket.off('newMessage', handleNewMessage);
    }, [socket]);

    // --- CÁC HÀM PHỤ TRỢ (HELPERS) ĐỂ RENDER UI ---

    // Lấy tên hiển thị cho cuộc trò chuyện
    const getConversationName = (conversation) => {
        // Nếu là nhóm chat
        if (conversation.type === 'group') {
            return conversation.name || 'Nhóm không tên';
        }

        // Nếu là chat cá nhân 1-1: tìm người không phải là mình
        const otherMember = conversation.members.find((member) => member._id !== user._id);
        return otherMember?.username || 'Người dùng';
    };

    // Lấy ký tự Avatar (Ví dụ: "Nam" -> "N")
    const getAvatar = (conversation) => {
        if (conversation.type === 'group') return 'G';

        const displayName = getConversationName(conversation);
        return displayName.charAt(0).toUpperCase();
    };

    // --- XỬ LÝ SỰ KIỆN NÚT BẤM ---

    const toggleSearchPanel = () => {
        setShowSearch(!showSearch);
        // Bật tìm kiếm thì tắt tạo nhóm
        setShowGroupModal(false);
    };

    const toggleGroupModal = () => {
        setShowGroupModal(!showGroupModal);
        // Bật tạo nhóm thì tắt tìm kiếm
        setShowSearch(false);
    };

    // Bật/tắt menu 3 chấm của từng cuộc trò chuyện
    const toggleMenu = (e, convId) => {
        // Ngăn click nhầm vào việc chọn đoạn chat
        e.stopPropagation();
        setOpenMenuId(openMenuId === convId ? null : convId);
        setDeleteConfirmId(null);
    };

    // Hàm xử lý khi xác nhận xóa cuộc trò chuyện
    const handleDeleteConversation = async (e, convId) => {
        e.stopPropagation();
        setDeletingId(convId);

        try {
            await deleteConversationAPI(convId);

            // Xóa hội thoại khỏi Sidebar sau khi Server xử lý thành công
            setConversations((prev) => prev.filter((conv) => conv._id !== convId));

            // Nếu đang mở chính hội thoại bị xóa thì bỏ chọn khung chat
            if (activeConversation?._id === convId) {
                onSelectConversation(null);
            }

            // Đóng menu và hộp xác nhận
            setOpenMenuId(null);
            setDeleteConfirmId(null);
        } catch (error) {
            console.error('Lỗi khi xóa cuộc trò chuyện:', error);
            alert(error.response?.data?.message || 'Không thể xóa đoạn chat, vui lòng thử lại!');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <aside className={styles.sidebar}>
            {/* --- PHẦN HEADER (Avatar và tên của MÌNH) --- */}
            <div className={styles.header}>
                <div className={styles.userInfo}>
                    <div className={styles.avatar}>
                        {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.username}>{user.username}</span>
                </div>

            </div>

            {/* --- PHẦN NÚT HÀNH ĐỘNG --- */}
            <div className={styles.actions}>
                <button
                    className={`${styles.actionBtn} ${showSearch ? styles.actionActive : ''}`}
                    onClick={toggleSearchPanel}
                >
                    🔍 Tìm người dùng
                </button>
                <button
                    className={`${styles.actionBtn} ${showGroupModal ? styles.actionActive : ''}`}
                    onClick={toggleGroupModal}
                >
                    ➕ Tạo nhóm
                </button>
            </div>

            {/* --- CÁC KHUNG CHỨC NĂNG (Bật/Tắt) --- */}
            {showSearch && (
                <UserSearch
                    onConversationCreated={(newConversation) => {
                        setConversations((prev) => {
                            // Tránh thêm trùng nếu cuộc trò chuyện này đã có sẵn ở Sidebar
                            const isExist = prev.find((conv) => conv._id === newConversation._id);
                            if (isExist) return prev;

                            // Thêm phòng mới lên trên cùng
                            return [newConversation, ...prev];
                        });

                        // Tự động chọn phòng này để nhảy sang khung chat
                        onSelectConversation(newConversation);
                        // Ẩn khung tìm kiếm đi
                        setShowSearch(false);
                    }}
                />
            )}

            {showGroupModal && (
                <CreateGroupModal
                    onClose={() => setShowGroupModal(false)}
                    onCreated={(newGroup) => {
                        // Thêm nhóm mới vào danh sách và đẩy lên đầu
                        setConversations((prev) => [newGroup, ...prev]);
                        // Nhảy vào chat nhóm đó luôn
                        onSelectConversation(newGroup);
                        setShowGroupModal(false);
                    }}
                />
            )}

            {/* --- DANH SÁCH CUỘC TRÒ CHUYỆN --- */}
            <div className={styles.list}>
                {conversations.length === 0 && (
                    <p className={styles.empty}>Chưa có cuộc trò chuyện nào.</p>
                )}

                {conversations.map((conv) => {
                    // Kiểm tra xem đây có phải là phòng chat đang được chọn không
                    const isCurrentlyActive = activeConversation?._id === conv._id;

                    return (
                        <div
                            key={conv._id}
                            className={`${styles.item} ${isCurrentlyActive ? styles.active : ''}`}
                            onClick={() => onSelectConversation(conv)}
                        >
                            <div className={styles.convAvatar}>
                                {getAvatar(conv)}
                            </div>

                            <div className={styles.convInfo}>
                                <span className={styles.convName}>
                                    {getConversationName(conv)}
                                </span>

                                <span className={styles.convTime}>
                                    {conv.updatedAt ? formatMessageTime(conv.updatedAt) : ''}
                                </span>
                            </div>

                            {/* --- KHU VỰC NÚT 3 CHẤM VÀ DROPDOWN XÓA --- */}
                            <div className={styles.optionsWrapper}>
                                <button
                                    className={styles.threeDotsBtn}
                                    onClick={(e) => toggleMenu(e, conv._id)}
                                >
                                    ⋮
                                </button>

                                {/* Giữ menu mở khi click bên trong dropdown */}
                                {openMenuId === conv._id && (
                                    <div
                                        className={styles.dropdownMenu}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {deleteConfirmId === conv._id ? (
                                            <>
                                                <p className={styles.confirmText}>
                                                    Xóa cuộc trò chuyện này?
                                                </p>
                                                <div className={styles.confirmActions}>
                                                    <button
                                                        className={styles.cancelDeleteBtn}
                                                        onClick={() => setDeleteConfirmId(null)}
                                                        disabled={deletingId === conv._id}
                                                    >
                                                        Hủy
                                                    </button>
                                                    <button
                                                        className={styles.confirmDeleteBtn}
                                                        onClick={(e) => handleDeleteConversation(e, conv._id)}
                                                        disabled={deletingId === conv._id}
                                                    >
                                                        {deletingId === conv._id ? 'Đang xóa...' : 'Xóa'}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => setDeleteConfirmId(conv._id)}
                                            >
                                                Xóa hội thoại
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
