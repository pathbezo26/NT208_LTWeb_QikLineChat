import { useState } from 'react';
import './styles/CreateConversationWindow.css';
import { createConversationAPI } from '../api/conversationAPI';

function CreateGroupModal({ onClose, onCreated }) {
    const [groupName, setGroupName] = useState('');
    const [memberId, setMemberId] = useState('');
    const [members, setMembers] = useState([]); // Danh sách các thành viên đã thêm
    const [loading, setLoading] = useState(false);

    const addMemberToList = () => {
        if (memberId && !members.includes(memberId)) {
            setMembers([...members, memberId]);
            setMemberId('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (members.length < 1) return alert("Vui lòng thêm ít nhất 1 thành viên");

        setLoading(true);
        try {
            const res = await createConversationAPI({
                type: 'group',
                name: groupName,
                members: members
            });
            onCreated(res.conversation);
        } catch (error) {
            alert(error.response?.data?.message || 'Lỗi khi tạo nhóm');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Tạo nhóm mới</h3>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Tên nhóm:</label>
                        <input 
                            type="text" 
                            required 
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Nhập tên nhóm..."
                        />
                    </div>

                    <div className="form-group">
                        <label>Thêm thành viên:</label>
                        <div className="input-with-button">
                            <input 
                                type="text" 
                                value={memberId}
                                onChange={(e) => setMemberId(e.target.value)}
                                placeholder="Nhập Username thành viên..."
                            />
                            <button className="btn-confirm-gradient" type='button' onClick={addMemberToList}>Thêm</button>
                            {/* <button className="btn-cancel" onClick={showMemberToList}>Xem</button> */}
                        </div>
                    </div>

                    {members.length > 0 && (
                        <div className="members-badge-list">
                            {members.map(id => (
                                <span key={id} className="member-badge">
                                    {id.substring(0, 8)}... 
                                    <i onClick={() => setMembers(members.filter(m => m !== id))}>&times;</i>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="modal-actions">
                        <button className="btn-cancel" onClick={onClose}>Hủy</button>
                        <button className="btn-confirm-gradient" type='submit' disabled={loading}>
                            {loading ? 'Đang tạo...' : 'Tạo nhóm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateGroupModal;