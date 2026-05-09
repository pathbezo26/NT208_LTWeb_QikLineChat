import { useState } from 'react';
import axiosInstance from '../api/axiosInstance';
import { createConversationAPI } from '../api/conversationAPI';
import styles from './styles/CreateGroupModal.module.css';

export default function CreateGroupModal({ onClose, onCreated }) {
    // Đổi tên state cho chuẩn và dễ hiểu hơn
    const [groupName, setGroupName] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);

    // Trạng thái Loading / Lỗi
    const [isSearching, setIsSearching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // 1. Xử lý khi người dùng gõ tìm kiếm thành viên
    const handleSearchUser = async (e) => {
        const keyword = e.target.value;
        setSearchKeyword(keyword);

        // Nếu xóa trắng ô tìm kiếm thì ẩn kết quả và dừng lại
        if (!keyword.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // Lưu ý: Do gọi axiosInstance trực tiếp nên vẫn cần .data
            const response = await axiosInstance.get(`/users/search?q=${encodeURIComponent(keyword)}`);
            const foundUsers = response.data;

            // Lọc bỏ những người đã được chọn vào nhóm (không hiển thị lại để tránh chọn trùng)
            const unselectedUsers = foundUsers.filter((user) => {
                const isAlreadySelected = selectedMembers.find((member) => member._id === user._id);
                return !isAlreadySelected;
            });

            setSearchResults(unselectedUsers);
        } catch (error) {
            setSearchResults([]);
            console.error('Lỗi khi tìm kiếm người dùng:', error);
        } finally {
            setIsSearching(false);
        }
    };

    // 2. Thêm người dùng vào danh sách nhóm
    const handleAddMember = (userToAdd) => {
        // Thêm vào mảng đã chọn
        setSelectedMembers((prevMembers) => [...prevMembers, userToAdd]);

        // Reset lại ô tìm kiếm cho sạch sẽ giao diện để gõ tìm người tiếp theo
        setSearchKeyword('');
        setSearchResults([]);
    };

    // 3. Xóa người dùng khỏi danh sách đã chọn
    const handleRemoveMember = (userIdToRemove) => {
        setSelectedMembers((prevMembers) => prevMembers.filter((user) => user._id !== userIdToRemove));
    };

    // 4. Bấm nút Tạo Nhóm
    const handleCreateGroup = async () => {
        // Validate cơ bản
        if (!groupName.trim()) {
            setErrorMessage('Vui lòng nhập tên nhóm.');
            return;
        }
        if (selectedMembers.length < 1) {
            setErrorMessage('Nhóm phải có ít nhất 1 thành viên khác.');
            return;
        }

        setErrorMessage('');
        setIsCreating(true);

        try {
            // Gọi API: Đã bỏ .data vì createConversationAPI đã được tối ưu trả về sẵn data (ở các bước trước)
            const newGroup = await createConversationAPI({
                type: 'group',
                name: groupName.trim(),
                // Backend chỉ cần mảng chứa các ID của thành viên
                members: selectedMembers.map((member) => member._id),
            });

            // Báo cho ChatPage biết là đã tạo xong (để đóng Modal và load lại danh sách)
            onCreated(newGroup);
        } catch (err) {
            setErrorMessage(err.response?.data?.message || 'Tạo nhóm thất bại. Vui lòng thử lại.');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                {/* Tiêu đề Modal */}
                <div className={styles.modalHeader}>
                    <h3>Tạo nhóm chat</h3>
                    <button className={styles.closeBtn} onClick={onClose} title="Đóng">✕</button>
                </div>

                {/* Báo lỗi nếu có */}
                {errorMessage && <div className={styles.error}>{errorMessage}</div>}

                {/* Nhập tên nhóm */}
                <div className={styles.field}>
                    <label htmlFor="groupName">Tên nhóm</label>
                    <input
                        id="groupName"
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="VD: Nhóm Đồ Án NT208"
                    />
                </div>

                {/* Tìm và thêm thành viên */}
                <div className={styles.field}>
                    <label htmlFor="searchUser">Thêm thành viên</label>
                    <input
                        id="searchUser"
                        type="text"
                        value={searchKeyword}
                        onChange={handleSearchUser}
                        placeholder="Tìm theo tên người dùng..."
                    />
                </div>

                {isSearching && <p className={styles.hint}>Đang tìm...</p>}

                {/* Danh sách kết quả tìm kiếm */}
                {searchResults.length > 0 && (
                    <ul className={styles.searchList}>
                        {searchResults.map((user) => (
                            <li key={user._id} className={styles.searchItem} onClick={() => handleAddMember(user)}>
                                <div className={styles.avatar}>{user.username.charAt(0).toUpperCase()}</div>
                                <span>{user.username}</span>
                                <span className={styles.addIcon}>＋</span>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Danh sách những người ĐÃ ĐƯỢC CHỌN (Chips) */}
                {selectedMembers.length > 0 && (
                    <div className={styles.selectedList}>
                        <p className={styles.selectedLabel}>Đã chọn ({selectedMembers.length}):</p>
                        <div className={styles.chips}>
                            {selectedMembers.map((member) => (
                                <span key={member._id} className={styles.chip}>
                                    {member.username}
                                    <button onClick={() => handleRemoveMember(member._id)}>✕</button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Nút hành động */}
                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose}>Hủy</button>
                    <button
                        className={styles.createBtn}
                        onClick={handleCreateGroup}
                        disabled={isCreating}
                    >
                        {isCreating ? 'Đang tạo...' : 'Tạo nhóm'}
                    </button>
                </div>
            </div>
        </div>
    );
}