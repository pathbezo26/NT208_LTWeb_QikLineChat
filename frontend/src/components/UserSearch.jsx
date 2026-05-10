import { useState, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance';
import { createConversationAPI } from '../api/conversationAPI';
import useAuth from '../hooks/useAuth';
import styles from './styles/UserSearch.module.css';

export default function UserSearch({ onConversationCreated }) {
    const { user: currentUser } = useAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creatingId, setCreatingId] = useState(null);

    const handleSearch = async (e) => {
        const value = e.target.value;
        setQuery(value);

        if (!value.trim()) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            // Gọi endpoint search đã định nghĩa trong backend
            const res = await axiosInstance.get(`/users/search?q=${encodeURIComponent(value)}`);
            // Lọc bỏ chính mình khỏi kết quả tìm kiếm
            const filtered = res.data.filter(u => u._id !== currentUser._id);
            setResults(filtered);
        } catch (err) {
            console.error("Search error:", err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleStartChat = async (targetUser) => {
        setCreatingId(targetUser._id);
        try {
            const res = await createConversationAPI({
                type: 'private',
                members: [targetUser._id],
            });
            // res.data thường chứa object conversation mới hoặc cũ nếu đã tồn tại
            onConversationCreated(res);
        } catch (err) {
            alert(err.response?.data?.message || 'Không thể tạo cuộc trò chuyện');
        } finally {
            setCreatingId(null);
        }
    };

    return (
        <div className={styles.panel}>
            <input
                className={styles.input}
                type="text"
                value={query}
                onChange={handleSearch}
                placeholder="Tìm bạn bè theo tên..."
                autoFocus
            />

            {loading && <p className={styles.status}>Đang tìm...</p>}

            {!loading && query && results.length === 0 && (
                <p className={styles.status}>Không tìm thấy kết quả nào.</p>
            )}

            <ul className={styles.list}>
                {results.map((u) => (
                    <li key={u._id} className={styles.item}>
                        <div className={styles.avatar}>
                            {u.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.info}>
                            <span className={styles.name}>{u.username}</span>
                            {/* <span className={styles.email}>{u.email}</span> */}
                        </div>
                        <button
                            className={styles.chatBtn}
                            onClick={() => handleStartChat(u)}
                            disabled={creatingId === u._id}
                        >
                            {creatingId === u._id ? '...' : 'Chat'}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}