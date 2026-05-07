import React, { useRef, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { updateAvatarAPI } from '../api/userAPI';
import './styles/UserFooter.css';

const UserFooter = () => {
    const { user, updateUserInfo } = useContext(AuthContext);
    const fileInputRef = useRef(null);

    if (!user) return null;

    const handleAvatarClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const data = await updateAvatarAPI(formData);
            // Update global state so the UI refreshes immediately
            updateUserInfo({ avatarUrl: data.user.avatarUrl });
            alert('Avatar updated!');
        } catch (err) {
            console.error(err);
            alert('Upload failed: ' + (err.response?.data?.message || err.message));
        }
    };

    // Calculate avatar source
    // If user has an avatarUrl, point to backend server, otherwise use a placeholder
    const avatarSrc = user.avatarUrl 
        ? `http://localhost:5000${user.avatarUrl}` 
        : `https://ui-avatars.com/api/?name=${user.username}&background=random`;

    return (
        <div className="user-footer-container">
            <div className="user-footer-content">
                <div className="avatar-wrapper" onClick={handleAvatarClick}>
                    <img src={avatarSrc} alt="avatar" className="footer-avatar" />
                    <div className="avatar-overlay">Edit</div>
                </div>
                <span className="footer-username">{user.username}</span>
            </div>

            {/* Hidden File Input */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                style={{ display: 'none' }} 
            />
        </div>
    );
};

export default UserFooter;