import { useEffect, useState } from 'react';
import { getConversationsAPI, deleteConversationAPI } from '../api/conversationAPI';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import UserSearch from './UserSearch';
import CreateGroupModal from './CreateGroupModal';
import { formatMessageTime } from '../utils/formatTime';
import styles from './styles/Sidebar.module.css';

export default function Sidebar({ activeConversation, onSelectConversation, onConversationDeleted }) {
    const { user, logout } = useAuth();
    const socket = useSocket();

    const [conversations, setConversations] = useState([]);

    // Trạng thái bật/tắt các khung tìm kiếm và tạo nhóm
    const [showSearch, setShowSearch] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);

    //State lưu trữ ID của đoạn chat đang mở menu 3 chấm
    const [openMenuId, setOpenMenuId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    //Click ra ngoài để đóng menu 3 chấm
    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null); // Đóng menu nếu click bất kỳ đâu trên màn hình
        };

        // Gắn sự kiện click vào toàn bộ trang
        document.addEventListener('click', handleClickOutside);

        // Dọn dẹp sự kiện khi component đóng lại hoặc chuyển trang
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    // 1. Hàm tải danh sách các cuộc trò chuyện từ Server
    const loadConversations = async () => {
        try {
            // Đã tối ưu destructuring dựa trên cấu trúc authAPI trả về thẳng data
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

        // Khi có người nhắn tin đến (ở bất kỳ phòng nào), ta gọi lại API 
        // để cập nhật lại tin nhắn mới nhất và đẩy phòng đó lên đầu.
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

        // Nếu là chat cá nhân 1-1: Tìm người không phải là mình
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
        setShowGroupModal(false); // Bật tìm kiếm thì phải tắt tạo nhóm đi
    };

    const toggleGroupModal = () => {
        setShowGroupModal(!showGroupModal);
        setShowSearch(false); // Bật tạo nhóm thì phải tắt tìm kiếm đi
    };

    //Bật/tắt menu 3 chấm
    const toggleMenu = (e, convId) => {
        e.stopPropagation(); // Ngăn click nhầm vào việc chọn đoạn chat
        setOpenMenuId(openMenuId === convId ? null : convId);
    };

    const requestDelete = (e, convId) => {
        e.stopPropagation();
        setConfirmDeleteId(convId); // Mở hộp thoại xác nhận thay vì xóa ngay
        setOpenMenuId(null); // Đóng menu 3 chấm lại
    };

    // HÀM XỬ LÝ KHI NHẤN VÀO "XÓA CUỘC TRÒ CHUYỆN"
    const executeDelete = async () => {
        if (!confirmDeleteId) return;

        try {
            await deleteConversationAPI(confirmDeleteId);
            setConversations((prev) => prev.filter((conv) => conv._id !== confirmDeleteId));

            if (activeConversation?._id === confirmDeleteId && onConversationDeleted) {
                onConversationDeleted();
            }
        } catch (error) {
            console.error("Lỗi khi xóa cuộc trò chuyện:", error);
        } finally {
            setConfirmDeleteId(null); // Xóa xong hoặc lỗi đều đóng hộp thoại
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

                <button className={styles.logoutBtn} onClick={logout} title="Đăng xuất">
                    ⎋
                </button>
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
                        setShowSearch(false); // Ẩn khung tìm kiếm đi
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
                    // Kiểm tra xem đây có phải là phòng chat đang được chọn (đang mở) không
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

                            {/*Khu vực chứa nút 3 chấm và dropdown*/}
                            <div className={styles.optionsWrapper}>
                                <button
                                    className={styles.threeDotsBtn}
                                    onClick={(e) => toggleMenu(e, conv._id)}
                                >
                                    ⋮
                                </button>

                                {openMenuId === conv._id && (
                                    <div className={styles.dropdownMenu}>
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={(e) => requestDelete(e, conv._id)}
                                        >
                                            Xóa hội thoại
                                        </button>
                                    </div>
                                )}
                            </div>
                            {confirmDeleteId && (
                                <div className={styles.modalOverlay}>
                                    <div className={styles.modalContent}>
                                        <h3>Xóa đoạn chat?</h3>
                                        <p>Xóa cuộc hội thoại(ở phía bạn).</p>
                                        <div className={styles.modalActions}>
                                            <button className={styles.cancelBtn} onClick={() => setConfirmDeleteId(null)}>
                                                Hủy
                                            </button>
                                            <button className={styles.confirmBtn} onClick={executeDelete}>
                                                Xóa
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
