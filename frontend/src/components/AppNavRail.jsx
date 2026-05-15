import { useState } from 'react';
import { Alert, Button, Popover, Switch, Upload } from 'antd';
import {
    ContactsOutlined,
    DeleteOutlined,
    EditOutlined,
    LogoutOutlined,
    MessageOutlined,
    MoonOutlined,
    SettingOutlined,
    SunOutlined,
    TeamOutlined,
    UploadOutlined,
} from '@ant-design/icons';
import { deleteAvatarAPI, updateUsernameAPI, uploadAvatarAPI } from '../api/userAPI';
import useAuth from '../hooks/useAuth';
import UserAvatar from './UserAvatar';
import styles from './styles/AppNavRail.module.css';

const navItems = [
    {
        id: 'messages',
        label: 'Messages',
        icon: <MessageOutlined />,
    },
    {
        id: 'contacts',
        label: 'Contacts',
        icon: <ContactsOutlined />,
    },
    {
        id: 'groups',
        label: 'Groups',
        icon: <TeamOutlined />,
    },
];

export default function AppNavRail({
    activeSection,
    onSectionChange,
    isDarkMode,
    onToggleDarkMode,
}) {
    const { user, logout, updateUser } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSettingOpen, setIsSettingOpen] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [isSavingUsername, setIsSavingUsername] = useState(false);
    const [usernameDraft, setUsernameDraft] = useState(user?.username || '');
    const [avatarError, setAvatarError] = useState('');
    const [usernameError, setUsernameError] = useState('');

    const handleLogout = () => {
        setIsProfileOpen(false);
        setIsSettingOpen(false);
        logout();
    };

    const handleUploadAvatar = async (file) => {
        // Validate nhanh ở frontend để người dùng biết lỗi trước khi gửi file lên server.
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setAvatarError('Avatar only supports JPG, PNG, or WEBP');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setAvatarError('Avatar must not exceed 2MB');
            return;
        }

        setIsUploadingAvatar(true);
        setAvatarError('');

        try {
            const data = await uploadAvatarAPI(file);
            updateUser(data.user);
            setIsProfileOpen(false);
        } catch (error) {
            setAvatarError(error.response?.data?.message || 'Could not update avatar');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const beforeUploadAvatar = (file) => {
        // Chặn Upload tự gửi request; mình tự gọi API để đi đúng luồng backend hiện tại.
        handleUploadAvatar(file);
        return Upload.LIST_IGNORE;
    };

    const openUsernameForm = () => {
        setUsernameDraft(user?.username || '');
        setUsernameError('');
        setIsEditingUsername(true);
    };

    const closeUsernameForm = () => {
        setIsEditingUsername(false);
        setUsernameError('');
        setUsernameDraft(user?.username || '');
    };

    const handleSaveUsername = async () => {
        const nextUsername = usernameDraft.trim();

        if (!nextUsername) {
            setUsernameError('Please enter a username');
            return;
        }

        if (nextUsername.length < 3 || nextUsername.length > 30) {
            setUsernameError('Username must be 3 to 30 characters');
            return;
        }

        if (nextUsername === user?.username) {
            closeUsernameForm();
            return;
        }

        setIsSavingUsername(true);
        setUsernameError('');

        try {
            const data = await updateUsernameAPI(nextUsername);
            updateUser(data.user);
            setIsEditingUsername(false);
        } catch (error) {
            setUsernameError(error.response?.data?.message || 'Could not update username');
        } finally {
            setIsSavingUsername(false);
        }
    };

    const handleDeleteAvatar = async () => {
        setAvatarError('');

        try {
            const data = await deleteAvatarAPI();
            updateUser(data.user);
            setIsProfileOpen(false);
        } catch (error) {
            setAvatarError(error.response?.data?.message || 'Could not delete avatar');
        }
    };

    const profileMenu = (
        <div className={styles.profileMenu}>
            <div className={styles.profileName}>{user?.username || 'Account'}</div>

            {avatarError && (
                <Alert
                    className={styles.profileError}
                    type="error"
                    message={avatarError}
                    showIcon
                />
            )}

            {usernameError && (
                <Alert
                    className={styles.profileError}
                    type="error"
                    message={usernameError}
                    showIcon
                />
            )}

            {isEditingUsername ? (
                <div className={styles.usernameForm}>
                    <input
                        className={styles.usernameInput}
                        value={usernameDraft}
                        onChange={(event) => setUsernameDraft(event.target.value)}
                        placeholder="New username"
                        maxLength={30}
                    />
                    <div className={styles.usernameActions}>
                        <Button
                            type="primary"
                            size="small"
                            loading={isSavingUsername}
                            onClick={handleSaveUsername}
                        >
                            Save
                        </Button>
                        <Button
                            size="small"
                            onClick={closeUsernameForm}
                            disabled={isSavingUsername}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <Button
                    className={styles.menuButton}
                    type="text"
                    icon={<EditOutlined />}
                    block
                    onClick={openUsernameForm}
                >
                    Change username
                </Button>
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
                    Remove avatar
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
                Log out
            </Button>
        </div>
    );

    const settingMenu = (
        <div className={styles.settingMenu}>
            <div className={styles.settingRow}>
                <div className={styles.settingText}>
                    <span className={styles.settingTitle}>Dark mode</span>
                    <span className={styles.settingDesc}>
                        {isDarkMode ? 'Soft dark interface' : 'Light interface'}
                    </span>
                </div>

                <Switch
                    size="small"
                    checked={isDarkMode}
                    onChange={onToggleDarkMode}
                    checkedChildren={<MoonOutlined />}
                    unCheckedChildren={<SunOutlined />}
                />
            </div>

            <Button
                className={styles.menuButton}
                type="text"
                icon={<LogoutOutlined />}
                block
                danger
                onClick={handleLogout}
            >
                Log out
            </Button>
        </div>
    );

    return (
        <nav className={styles.rail} aria-label="Main navigation">
            <Popover
                content={profileMenu}
                trigger="click"
                placement="rightTop"
                rootClassName={styles.navPopover}
                overlayClassName={styles.navPopover}
                open={isProfileOpen}
                onOpenChange={(open) => {
                    setIsProfileOpen(open);
                    if (!open) {
                        setAvatarError('');
                        closeUsernameForm();
                    }
                }}
            >
                <button
                    type="button"
                    className={styles.userIconButton}
                    title={user?.username || 'Account'}
                    aria-label="Open account menu"
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
                    rootClassName={styles.navPopover}
                    overlayClassName={styles.navPopover}
                    open={isSettingOpen}
                    onOpenChange={setIsSettingOpen}
                >
                    <button
                        type="button"
                        className={`${styles.navButton} ${activeSection === 'settings' ? styles.active : ''}`}
                        onClick={() => onSectionChange('settings')}
                        title="Settings"
                        aria-label="Settings"
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
