import { useState } from 'react';
import { Alert, Button, Popover, Upload } from 'antd';
import {
    ContactsOutlined,
    DeleteOutlined,
    LogoutOutlined,
    MessageOutlined,
    SettingOutlined,
    TeamOutlined,
    UploadOutlined,
} from '@ant-design/icons';
import { deleteAvatarAPI, uploadAvatarAPI } from '../api/userAPI';
import useAuth from '../hooks/useAuth';
import UserAvatar from './UserAvatar';
import styles from './styles/AppNavRail.module.css';

const navItems = [
    {
        id: 'messages',
        label: 'Tin nhắn',
        icon: <MessageOutlined />,
    },
    {
        id: 'contacts',
        label: 'Danh bạ',
        icon: <ContactsOutlined />,
    },
    {
        id: 'groups',
        label: 'Nhóm',
        icon: <TeamOutlined />,
    },
];

export default function AppNavRail({ activeSection, onSectionChange }) {
    const { user, logout, updateUser } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSettingOpen, setIsSettingOpen] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [avatarError, setAvatarError] = useState('');

    const handleLogout = () => {
        setIsProfileOpen(false);
        setIsSettingOpen(false);
        logout();
    };

    const handleUploadAvatar = async (file) => {
        // Validate nhanh ở frontend để người dùng biết lỗi trước khi gửi file lên server.
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setAvatarError('Avatar chỉ hỗ trợ JPG, PNG hoặc WEBP');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setAvatarError('Avatar không được vượt quá 2MB');
            return;
        }

        setIsUploadingAvatar(true);
        setAvatarError('');

        try {
            const data = await uploadAvatarAPI(file);
            updateUser(data.user);
            setIsProfileOpen(false);
        } catch (error) {
            setAvatarError(error.response?.data?.message || 'Không thể cập nhật avatar');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const beforeUploadAvatar = (file) => {
        // Chặn Upload tự gửi request; mình tự gọi API để đi đúng luồng backend hiện tại.
        handleUploadAvatar(file);
        return Upload.LIST_IGNORE;
    };

    const handleDeleteAvatar = async () => {
        setAvatarError('');

        try {
            const data = await deleteAvatarAPI();
            updateUser(data.user);
            setIsProfileOpen(false);
        } catch (error) {
            setAvatarError(error.response?.data?.message || 'Không thể xóa avatar');
        }
    };

    const profileMenu = (
        <div className={styles.profileMenu}>
            <div className={styles.profileName}>{user?.username || 'Tài khoản'}</div>

            {avatarError && (
                <Alert
                    className={styles.profileError}
                    type="error"
                    message={avatarError}
                    showIcon
                />
            )}

            <Upload
                className={styles.menuUpload}
                showUploadList={false}
                accept="image/jpeg,image/png,image/webp"
                beforeUpload={beforeUploadAvatar}
                disabled={isUploadingAvatar}
            >
                <Button
                    className={styles.menuButton}
                    type="text"
                    icon={<UploadOutlined />}
                    block
                    loading={isUploadingAvatar}
                >
                    Upload photo
                </Button>
            </Upload>

            {user?.avatar?.url && (
                <Button
                    className={styles.menuButton}
                    type="text"
                    icon={<DeleteOutlined />}
                    block
                    onClick={handleDeleteAvatar}
                >
                    Xóa avatar
                </Button>
            )}

            <Button
                className={styles.menuButton}
                type="text"
                icon={<LogoutOutlined />}
                block
                danger
                onClick={handleLogout}
            >
                Đăng xuất
            </Button>
        </div>
    );

    const settingMenu = (
        <div className={styles.settingMenu}>
            <Button
                className={styles.menuButton}
                type="text"
                icon={<LogoutOutlined />}
                block
                danger
                onClick={handleLogout}
            >
                Đăng xuất
            </Button>
        </div>
    );

    return (
        <nav className={styles.rail} aria-label="Điều hướng chính">
            <Popover
                content={profileMenu}
                trigger="click"
                placement="rightTop"
                open={isProfileOpen}
                onOpenChange={(open) => {
                    setIsProfileOpen(open);
                    if (!open) setAvatarError('');
                }}
            >
                <button
                    type="button"
                    className={styles.userIconButton}
                    title={user?.username || 'Tài khoản'}
                    aria-label="Mở menu tài khoản"
                >
                    <UserAvatar
                        user={user}
                        className={styles.userIcon}
                        fallback="U"
                    />
                </button>
            </Popover>

            <div className={styles.navList}>
                {navItems.map((item) => {
                    const isActive = activeSection === item.id;

                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`${styles.navButton} ${isActive ? styles.active : ''}`}
                            onClick={() => onSectionChange(item.id)}
                            title={item.label}
                            aria-label={item.label}
                            aria-pressed={isActive}
                        >
                            <span className={styles.icon}>{item.icon}</span>
                        </button>
                    );
                })}
            </div>

            <div className={styles.bottomNav}>
                <Popover
                    content={settingMenu}
                    trigger="click"
                    placement="rightBottom"
                    open={isSettingOpen}
                    onOpenChange={setIsSettingOpen}
                >
                    <button
                        type="button"
                        className={`${styles.navButton} ${activeSection === 'settings' ? styles.active : ''}`}
                        onClick={() => onSectionChange('settings')}
                        title="Cài đặt"
                        aria-label="Cài đặt"
                        aria-pressed={activeSection === 'settings'}
                    >
                        <span className={styles.icon}>
                            <SettingOutlined />
                        </span>
                    </button>
                </Popover>
            </div>
        </nav>
    );
}
