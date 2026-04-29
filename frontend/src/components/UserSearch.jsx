import { useState } from 'react';
import './styles/CreateConversationWindow.css';
import { createConversationAPI } from '../api/conversationAPI';
// Giả sử bạn có api tìm kiếm user, nếu chưa có hãy dùng tạm input ID
// import { searchUsersAPI } from '../api/userAPI'; 

function UserSearch({ onClose, onSelect }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearchAndCreate = async (e) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        setLoading(true);
        try {
            // Ở đây logic đơn giản là tạo chat với ID hoặc Email người dùng nhập vào
            // Backend của bạn sẽ xử lý việc tìm user và kiểm tra trùng lặp
            const res = await createConversationAPI({
                type: 'private',
                members: [searchTerm] // searchTerm ở đây có thể là userId của người kia
            });

            onSelect(res.conversation); // Trả kết quả về ChatPage
        } catch (error) {
            alert(error.response?.data?.message || 'Không tìm thấy người dùng hoặc lỗi server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Tìm kiếm người dùng</h3>
                </div>
                
                <form onSubmit={handleSearchAndCreate}>
                    <div className="form-group">
                        <label>Nhập tên người dùng:</label>
                        <input 
                            type="text" 
                            placeholder="Username" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="modal-actions">
                        <button className="btn-cancel" onClick={onClose}>Hủy</button>
                        <button className="btn-confirm-gradient" type='submit' disabled={loading}>
                            {loading ? 'Đang kết nối...' : 'Bắt đầu Chat'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default UserSearch;