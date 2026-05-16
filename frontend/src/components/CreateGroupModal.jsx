import { useEffect, useRef, useState } from 'react';
import { CameraOutlined } from '@ant-design/icons';
import axiosInstance from '../api/axiosInstance';
import { createConversationAPI, uploadGroupAvatarAPI } from '../api/conversationAPI';
import styles from './styles/CreateGroupModal.module.css';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function CreateGroupModal({ onClose, onCreated }) {
    const [groupName, setGroupName] = useState('');
    const [groupAvatarFile, setGroupAvatarFile] = useState(null);
    const [groupAvatarPreview, setGroupAvatarPreview] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const searchIdRef = useRef(0);
    const avatarInputRef = useRef(null);

    useEffect(() => {
        if (!groupAvatarFile) {
            setGroupAvatarPreview('');
            return undefined;
        }

        const previewUrl = URL.createObjectURL(groupAvatarFile);
        setGroupAvatarPreview(previewUrl);

        return () => URL.revokeObjectURL(previewUrl);
    }, [groupAvatarFile]);

    const handlePickGroupAvatar = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';

        if (!file) return;

        if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
            setErrorMessage('Group image only supports JPG, PNG, or WEBP.');
            return;
        }

        if (file.size > MAX_AVATAR_SIZE) {
            setErrorMessage('Group image must not exceed 2MB.');
            return;
        }

        setErrorMessage('');
        setGroupAvatarFile(file);
    };

    const handleSearchUser = async (e) => {
        const keyword = e.target.value;
        setSearchKeyword(keyword);

        // Nếu xóa trắng ô tìm kiếm thì ẩn kết quả và dừng lại
        if (!keyword.trim()) {
            searchIdRef.current += 1;
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const searchId = searchIdRef.current + 1;
        searchIdRef.current = searchId;
        setIsSearching(true);

        try {
            const response = await axiosInstance.get(`/users/search?q=${encodeURIComponent(keyword)}`);
            if (searchId !== searchIdRef.current) return;

            const unselectedUsers = response.data.filter((searchUser) => {
                return !selectedMembers.find((member) => member._id === searchUser._id);
            });

            setSearchResults(unselectedUsers);
        } catch (error) {
            if (searchId !== searchIdRef.current) return;
            console.error('Search users error:', error);
            setSearchResults([]);
        } finally {
            if (searchId === searchIdRef.current) {
                setIsSearching(false);
            }
        }
    };

    const handleAddMember = (userToAdd) => {
        setSelectedMembers((prevMembers) => [...prevMembers, userToAdd]);
        setSearchKeyword('');
        setSearchResults([]);
    };

    const handleRemoveMember = (userIdToRemove) => {
        setSelectedMembers((prevMembers) => {
            return prevMembers.filter((member) => member._id !== userIdToRemove);
        });
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            setErrorMessage('Please enter a group name.');
            return;
        }

        if (selectedMembers.length < 1) {
            setErrorMessage('The group must have at least 1 other member.');
            return;
        }

        setErrorMessage('');
        setIsCreating(true);

        try {
            let newGroup = await createConversationAPI({
                type: 'group',
                name: groupName.trim(),
                members: selectedMembers.map((member) => member._id),
            });

            if (groupAvatarFile) {
                const data = await uploadGroupAvatarAPI(newGroup._id, groupAvatarFile);
                newGroup = data.conversation;
            }

            onCreated(newGroup);
        } catch (err) {
            setErrorMessage(err.response?.data?.message || 'Failed to create group. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h3>Create group chat</h3>
                    <button className={styles.closeBtn} onClick={onClose} title="Close" type="button">×</button>
                </div>

                {errorMessage && <div className={styles.error}>{errorMessage}</div>}

                <div className={styles.avatarPicker}>
                    <button
                        className={styles.groupAvatarButton}
                        onClick={() => avatarInputRef.current?.click()}
                        type="button"
                        aria-label="Choose group image"
                    >
                        {groupAvatarPreview ? (
                            <img src={groupAvatarPreview} alt="Group image preview" />
                        ) : (
                            <>
                                <CameraOutlined className={styles.cameraIcon} />
                                <span>{groupName.trim().charAt(0).toUpperCase() || 'G'}</span>
                            </>
                        )}
                    </button>
                    <button
                        className={styles.avatarTextButton}
                        onClick={() => avatarInputRef.current?.click()}
                        type="button"
                    >
                        Choose group image
                    </button>
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className={styles.hiddenInput}
                        onChange={handlePickGroupAvatar}
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="groupName">Group name</label>
                    <input
                        id="groupName"
                        type="text"
                        autoComplete="off"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Enter group name"
                    />
                </div>

                {/* Tìm và thêm thành viên */}
                <div className={styles.field}>
                    <label htmlFor="searchUser">Add members</label>
                    <input
                        id="searchUser"
                        type="text"
                        autoComplete="off"
                        value={searchKeyword}
                        onChange={handleSearchUser}
                        placeholder="Search by username..."
                    />
                </div>

                {isSearching && <p className={styles.hint}>Searching...</p>}

                {/* Danh sách kết quả tìm kiếm */}
                {searchResults.length > 0 && (
                    <ul className={styles.searchList}>
                        {searchResults.map((searchUser) => (
                            <li
                                key={searchUser._id}
                                className={styles.searchItem}
                                onClick={() => handleAddMember(searchUser)}
                            >
                                <div className={styles.avatar}>
                                    {searchUser.username.charAt(0).toUpperCase()}
                                </div>
                                <span>{searchUser.username}</span>
                                <span className={styles.addIcon}>+</span>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Danh sách những người ĐÃ ĐƯỢC CHỌN (Chips) */}
                {selectedMembers.length > 0 && (
                    <div className={styles.selectedList}>
                        <p className={styles.selectedLabel}>Selected ({selectedMembers.length}):</p>
                        <div className={styles.chips}>
                            {selectedMembers.map((member) => (
                                <span key={member._id} className={styles.chip}>
                                    {member.username}
                                    <button onClick={() => handleRemoveMember(member._id)} type="button">×</button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Nút hành động */}
                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose} type="button">Cancel</button>
                    <button
                        className={styles.createBtn}
                        onClick={handleCreateGroup}
                        disabled={isCreating}
                        type="button"
                    >
                        {isCreating ? 'Creating...' : 'Create group'}
                    </button>
                </div>
            </div>
        </div>
    );
}
