import { useRef, useState } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import axiosInstance from '../api/axiosInstance';
import { createConversationAPI } from '../api/conversationAPI';
import styles from './styles/SidebarSearch.module.css';

export default function SidebarSearch({ currentUserId, onConversationCreated }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creatingUserId, setCreatingUserId] = useState(null);
    const searchIdRef = useRef(0);

    const handleSearch = async (e) => {
        const value = e.target.value;
        setQuery(value);

        if (!value.trim()) {
            searchIdRef.current += 1;
            setResults([]);
            setLoading(false);
            return;
        }

        const searchId = searchIdRef.current + 1;
        searchIdRef.current = searchId;
        setLoading(true);

        try {
            const res = await axiosInstance.get(`/users/search?q=${encodeURIComponent(value)}`);
            if (searchId !== searchIdRef.current) return;

            setResults(res.data.filter((user) => user._id !== currentUserId));
        } catch (error) {
            if (searchId !== searchIdRef.current) return;
            console.error('Search error:', error);
            setResults([]);
        } finally {
            if (searchId === searchIdRef.current) {
                setLoading(false);
            }
        }
    };

    const handleStartChat = async (targetUser) => {
        setCreatingUserId(targetUser._id);

        try {
            const newConversation = await createConversationAPI({
                type: 'private',
                members: [targetUser._id],
            });

            onConversationCreated(newConversation);
            setQuery('');
            setResults([]);
        } catch (error) {
            alert(error.response?.data?.message || 'Không thể tạo cuộc trò chuyện');
        } finally {
            setCreatingUserId(null);
        }
    };

    return (
        <div className={styles.searchArea}>
            <div className={styles.searchBox}>
                <SearchOutlined className={styles.searchIcon} />
                <input
                    className={styles.searchInput}
                    type="text"
                    value={query}
                    onChange={handleSearch}
                    placeholder="Tìm kiếm"
                />
            </div>

            {query.trim() && (
                <div className={styles.results}>
                    {loading && <p className={styles.status}>Đang tìm...</p>}

                    {!loading && results.length === 0 && (
                        <p className={styles.status}>Không tìm thấy kết quả nào.</p>
                    )}

                    {!loading && results.map((user) => (
                        <button
                            key={user._id}
                            type="button"
                            className={styles.resultItem}
                            onClick={() => handleStartChat(user)}
                            disabled={creatingUserId === user._id}
                        >
                            <span className={styles.avatar}>
                                {user.username?.charAt(0).toUpperCase()}
                            </span>
                            <span className={styles.name}>{user.username}</span>
                            <span className={styles.action}>
                                {creatingUserId === user._id ? '...' : 'Chat'}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
