import { useState } from 'react';
import './styles/CreateConversationWindow.css';
import { createConversationAPI } from '../api/conversationAPI';
// Giả sử bạn có api tìm kiếm user, nếu chưa có hãy dùng tạm input ID
// import { searchUsersAPI } from '../api/userAPI'; 

function UserSearch({ onClose, onSelect }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const identifier = searchTerm.trim();
        if (!identifier) return;

        setLoading(true);
        try {
            const res = await createConversationAPI({
                type: 'private',
                members: [identifier] 
            });

            // Backend trả về conversation
            if (res && res.conversation) {
                onSelect(res.conversation); 
                onClose();
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Lỗi kết nối');
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
                
                <form onSubmit={handleSubmit}>
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