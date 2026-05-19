import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal, Popover, Slider, Switch, Upload } from 'antd';
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
    UserOutlined,
} from '@ant-design/icons';
import {
    deleteAvatarAPI,
    updateAvatarCropAPI,
    updateUserIdAPI,
    updateUsernameAPI,
    uploadAvatarAPI,
} from '../api/userAPI';
import useAuth from '../hooks/useAuth';
import UserAvatar from './UserAvatar';
import styles from './styles/AppNavRail.module.css';

const navItems = [
    { id: 'messages', label: 'Messages', icon: <MessageOutlined /> },
    { id: 'contacts', label: 'Contacts', icon: <ContactsOutlined /> },
    { id: 'groups', label: 'Groups', icon: <TeamOutlined /> },
];

export default function AppNavRail({
    activeSection,
    onSectionChange,
    isDarkMode,
    onToggleDarkMode,
    badges = {},
}) {
    const { user, logout, updateUser } = useAuth();
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isSettingOpen, setIsSettingOpen] = useState(false);
    const [isSavingUsername, setIsSavingUsername] = useState(false);
    const [isSavingUserId, setIsSavingUserId] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [usernameDraft, setUsernameDraft] = useState(user?.username || '');
    const [userIdDraft, setUserIdDraft] = useState(user?.userId || '');
    const [profileError, setProfileError] = useState('');
    const [avatarCropUrl, setAvatarCropUrl] = useState('');
    const [avatarCropFile, setAvatarCropFile] = useState(null);
    const [avatarImageSize, setAvatarImageSize] = useState({ width: 0, height: 0 });
    const [avatarZoom, setAvatarZoom] = useState(1);
    const [avatarOffset, setAvatarOffset] = useState({ x: 0, y: 0 });
    const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
    const [isAvatarEditing, setIsAvatarEditing] = useState(false);
    const [avatarCropMode, setAvatarCropMode] = useState('upload');
    const dragStateRef = useRef(null);
    const avatarCropUrlRef = useRef('');
    const avatarInitialZoomRef = useRef(1);

    const AVATAR_CROP_SIZE = 280;

    const resetProfileDrafts = () => {
        setUsernameDraft(user?.username || '');
        setUserIdDraft(user?.userId || '');
        setProfileError('');
        clearAvatarCrop();
    };

    const clearAvatarCrop = () => {
        if (avatarCropUrlRef.current) {
            URL.revokeObjectURL(avatarCropUrlRef.current);
            avatarCropUrlRef.current = '';
        }

        setAvatarCropUrl('');
        setAvatarCropFile(null);
        setAvatarImageSize({ width: 0, height: 0 });
        setAvatarZoom(1);
        setAvatarOffset({ x: 0, y: 0 });
        setIsAvatarEditing(false);
        setAvatarCropMode('upload');
        dragStateRef.current = null;
        avatarInitialZoomRef.current = 1;
    };

    useEffect(() => () => clearAvatarCrop(), []);

    const openProfileModal = () => {
        resetProfileDrafts();
        setIsProfileMenuOpen(false);
        setIsProfileModalOpen(true);
    };

    const closeProfileModal = () => {
        setIsProfileModalOpen(false);
        setIsAvatarPreviewOpen(false);
        clearAvatarCrop();
    };

    const handleLogout = () => {
        setIsProfileMenuOpen(false);
        setIsSettingOpen(false);
        setIsProfileModalOpen(false);
        logout();
    };

    const handleSaveUsername = async () => {
        const nextUsername = usernameDraft.trim();

        if (!nextUsername) {
            setProfileError('Please enter a username');
            return;
        }

        if (nextUsername.length < 3 || nextUsername.length > 30) {
            setProfileError('Username must be 3 to 30 characters');
            return;
        }

        if (nextUsername === user?.username) return;

        setIsSavingUsername(true);
        setProfileError('');

        try {
            const data = await updateUsernameAPI(nextUsername);
            updateUser(data.user);
        } catch (error) {
            setProfileError(error.response?.data?.message || 'Could not update username');
        } finally {
            setIsSavingUsername(false);
        }
    };

    const handleSaveUserId = async () => {
        const nextUserId = userIdDraft.trim().toLowerCase();

        if (!nextUserId) {
            setProfileError('Please enter a User ID');
            return;
        }

        if (!/^[a-z0-9._]{3,30}$/.test(nextUserId)) {
            setProfileError('User ID can only contain letters, numbers, dots, and underscores');
            return;
        }

        if (nextUserId === user?.userId) return;

        setIsSavingUserId(true);
        setProfileError('');

        try {
            const data = await updateUserIdAPI(nextUserId);
            updateUser(data.user);
        } catch (error) {
            setProfileError(error.response?.data?.message || 'Could not update User ID');
        } finally {
            setIsSavingUserId(false);
        }
    };

    const clampAvatarOffset = (offset, zoom = avatarZoom, imageSize = avatarImageSize) => {
        if (!imageSize.width || !imageSize.height) return { x: 0, y: 0 };

        const baseScale = Math.max(AVATAR_CROP_SIZE / imageSize.width, AVATAR_CROP_SIZE / imageSize.height);
        const displayWidth = imageSize.width * baseScale * zoom;
        const displayHeight = imageSize.height * baseScale * zoom;
        const maxX = Math.max(0, (displayWidth - AVATAR_CROP_SIZE) / 2);
        const maxY = Math.max(0, (displayHeight - AVATAR_CROP_SIZE) / 2);

        return {
            x: Math.min(maxX, Math.max(-maxX, offset.x)),
            y: Math.min(maxY, Math.max(-maxY, offset.y)),
        };
    };

    const handleSelectAvatar = (file) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setProfileError('Avatar only supports JPG, PNG, or WEBP');
            return Upload.LIST_IGNORE;
        }

        if (file.size > 2 * 1024 * 1024) {
            setProfileError('Avatar must not exceed 2MB');
            return Upload.LIST_IGNORE;
        }

        setProfileError('');
        clearAvatarCrop();
        avatarInitialZoomRef.current = 1;

        const nextUrl = URL.createObjectURL(file);
        avatarCropUrlRef.current = nextUrl;
        setAvatarCropUrl(nextUrl);
        setAvatarCropFile(file);
        setAvatarCropMode('upload');
        setIsAvatarPreviewOpen(true);
        setIsAvatarEditing(true);

        return Upload.LIST_IGNORE;
    };

    const openAvatarPreview = () => {
        setIsAvatarPreviewOpen(true);
        setProfileError('');
        clearAvatarCrop();
    };

    const closeAvatarPreview = () => {
        setIsAvatarPreviewOpen(false);
        clearAvatarCrop();
    };

    const handleEditCurrentAvatar = async () => {
        if (!user?.avatar?.url) {
            setProfileError('Please update an avatar first');
            return;
        }

        setIsUploadingAvatar(true);
        setProfileError('');

        try {
            const avatarSourceUrl = user.avatar.originalUrl || user.avatar.url;
            const response = await fetch(avatarSourceUrl, { mode: 'cors' });
            if (!response.ok) {
                throw new Error('Could not load current avatar');
            }

            const blob = await response.blob();
            clearAvatarCrop();
            avatarInitialZoomRef.current = user.avatar.originalUrl ? 1 : 1.08;

            const editFile = new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' });
            const nextUrl = URL.createObjectURL(editFile);
            avatarCropUrlRef.current = nextUrl;
            setAvatarCropUrl(nextUrl);
            setAvatarCropFile(editFile);
            setAvatarCropMode('edit');
            setIsAvatarPreviewOpen(true);
            setIsAvatarEditing(true);
        } catch (error) {
            setProfileError(error.message || 'Could not load current avatar');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleAvatarImageLoad = (event) => {
        const imageSize = {
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
        };

        setAvatarImageSize(imageSize);
        const nextZoom = avatarInitialZoomRef.current;
        setAvatarZoom(nextZoom);
        setAvatarOffset(clampAvatarOffset({ x: 0, y: 0 }, nextZoom, imageSize));
    };

    const handleAvatarZoomChange = (value) => {
        setAvatarZoom(value);
        setAvatarOffset((current) => clampAvatarOffset(current, value));
    };

    const handleAvatarPointerDown = (event) => {
        if (!avatarCropUrl) return;

        event.currentTarget.setPointerCapture(event.pointerId);
        dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startOffset: avatarOffset,
        };
    };

    const handleAvatarPointerMove = (event) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        const nextOffset = {
            x: dragState.startOffset.x + event.clientX - dragState.startX,
            y: dragState.startOffset.y + event.clientY - dragState.startY,
        };

        setAvatarOffset(clampAvatarOffset(nextOffset));
    };

    const handleAvatarPointerUp = (event) => {
        if (dragStateRef.current?.pointerId === event.pointerId) {
            dragStateRef.current = null;
        }
    };

    const getAvatarCropPayload = () => {
        if (!avatarCropUrl || !avatarCropFile || !avatarImageSize.width || !avatarImageSize.height) {
            throw new Error('Please select an avatar image');
        }

        const baseScale = Math.max(AVATAR_CROP_SIZE / avatarImageSize.width, AVATAR_CROP_SIZE / avatarImageSize.height);
        const effectiveScale = baseScale * avatarZoom;
        const sourceSize = AVATAR_CROP_SIZE / effectiveScale;
        const sourceX = (avatarImageSize.width - sourceSize) / 2 - avatarOffset.x / effectiveScale;
        const sourceY = (avatarImageSize.height - sourceSize) / 2 - avatarOffset.y / effectiveScale;
        const maxX = Math.max(0, avatarImageSize.width - sourceSize);
        const maxY = Math.max(0, avatarImageSize.height - sourceSize);

        return {
            x: Math.round(Math.min(maxX, Math.max(0, sourceX))),
            y: Math.round(Math.min(maxY, Math.max(0, sourceY))),
            size: Math.round(sourceSize),
        };
    };

    const handleSaveCroppedAvatar = async () => {
        setIsUploadingAvatar(true);
        setProfileError('');

        try {
            const avatarCrop = getAvatarCropPayload();
            const data = avatarCropMode === 'edit'
                ? await updateAvatarCropAPI(avatarCrop)
                : await uploadAvatarAPI(avatarCropFile, avatarCrop);
            updateUser(data.user);
            clearAvatarCrop();
            setIsAvatarPreviewOpen(false);
        } catch (error) {
            setProfileError(error.response?.data?.message || error.message || 'Could not update avatar');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleDeleteAvatar = async () => {
        setIsUploadingAvatar(true);
        setProfileError('');

        try {
            const data = await deleteAvatarAPI();
            updateUser(data.user);
            clearAvatarCrop();
            setIsAvatarPreviewOpen(false);
        } catch (error) {
            setProfileError(error.response?.data?.message || 'Could not delete avatar');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const profileMenu = (
        <div className={styles.profileQuickMenu}>
            <div className={styles.profileMenuHeader}>
                <UserAvatar user={user} className={styles.profileMenuAvatar} fallback="U" />
                <div className={styles.profileMenuIdentity}>
                    <strong>{user?.username || 'Account'}</strong>
                    <span>{user?.email || (user?.userId ? `@${user.userId}` : 'No email')}</span>
                </div>
            </div>
            <button className={styles.quickMenuButton} type="button" onClick={openProfileModal}>
                <UserOutlined />
                <span>My profile</span>
            </button>
            <button className={`${styles.quickMenuButton} ${styles.quickMenuDanger}`} type="button" onClick={handleLogout}>
                <LogoutOutlined />
                <span>Log out</span>
            </button>
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
                open={isProfileMenuOpen}
                onOpenChange={setIsProfileMenuOpen}
            >
                <button
                    type="button"
                    className={styles.userIconButton}
                    title={user?.username || 'Account'}
                    aria-label="Open account menu"
                >
                    <UserAvatar user={user} className={styles.userIcon} fallback="U" />
                </button>
            </Popover>

            <div className={styles.navList}>
                {navItems.map((item) => {
                    const isActive = activeSection === item.id;
                    const hasUnreadMessages = item.id === 'messages' && Number(badges.unreadMessages) > 0;
                    const hasIncomingContacts = item.id === 'contacts' && Number(badges.incomingContacts) > 0;

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
                            {hasUnreadMessages && (
                                <span className={`${styles.navDot} ${styles.messageDot}`} aria-label={`${badges.unreadMessages} unread messages`} />
                            )}
                            {hasIncomingContacts && (
                                <span className={`${styles.navDot} ${styles.contactDot}`} aria-label={`${badges.incomingContacts} contact requests`} />
                            )}
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
                        className={`${styles.navButton} ${isSettingOpen ? styles.active : ''}`}
                        title="Settings"
                        aria-label="Settings"
                        aria-expanded={isSettingOpen}
                    >
                        <span className={styles.icon}>
                            <SettingOutlined />
                        </span>
                    </button>
                </Popover>
            </div>

            <Modal
                open={isProfileModalOpen}
                onCancel={closeProfileModal}
                footer={null}
                centered
                width={430}
                className={styles.profileModal}
                title="My profile"
            >
                <div className={styles.profilePanel}>
                    <div className={styles.profileHero}>
                        <button
                            type="button"
                            className={styles.profileAvatarButton}
                            onClick={openAvatarPreview}
                            aria-label="Preview avatar"
                        >
                            <UserAvatar user={user} className={styles.profileHeroAvatar} fallback="U" />
                        </button>
                        <div className={styles.profileHeroText}>
                            <strong>{user?.username || 'Account'}</strong>
                            <span>{user?.userId ? `@${user.userId}` : 'No User ID yet'}</span>
                        </div>
                    </div>

                    {profileError && (
                        <Alert className={styles.profileError} type="error" message={profileError} showIcon />
                    )}

                    {isAvatarPreviewOpen && (
                        <div className={styles.avatarPreviewPanel}>
                            {isAvatarEditing && avatarCropUrl ? (
                                <div className={styles.avatarCropPanel}>
                                    <div
                                        className={styles.avatarCropFrame}
                                        role="presentation"
                                        onPointerDown={handleAvatarPointerDown}
                                        onPointerMove={handleAvatarPointerMove}
                                        onPointerUp={handleAvatarPointerUp}
                                        onPointerCancel={handleAvatarPointerUp}
                                    >
                                        <img
                                            src={avatarCropUrl}
                                            alt="Avatar preview"
                                            className={styles.avatarCropImage}
                                            style={{
                                                width: avatarImageSize.width
                                                    ? `${avatarImageSize.width * Math.max(AVATAR_CROP_SIZE / avatarImageSize.width, AVATAR_CROP_SIZE / avatarImageSize.height) * avatarZoom}px`
                                                    : '100%',
                                                height: avatarImageSize.height
                                                    ? `${avatarImageSize.height * Math.max(AVATAR_CROP_SIZE / avatarImageSize.width, AVATAR_CROP_SIZE / avatarImageSize.height) * avatarZoom}px`
                                                    : '100%',
                                                transform: `translate(-50%, -50%) translate(${avatarOffset.x}px, ${avatarOffset.y}px)`,
                                            }}
                                            draggable={false}
                                            crossOrigin={!avatarCropUrl.startsWith('blob:') ? 'anonymous' : undefined}
                                            onLoad={handleAvatarImageLoad}
                                        />
                                        <div className={styles.avatarCropShade} />
                                        <div className={styles.avatarCropCircle}>
                                            <span />
                                            <span />
                                            <span />
                                            <span />
                                        </div>
                                    </div>

                                    <div className={styles.avatarCropControls}>
                                        <span>Zoom</span>
                                        <Slider
                                            min={1}
                                            max={3}
                                            step={0.01}
                                            value={avatarZoom}
                                            onChange={handleAvatarZoomChange}
                                            tooltip={{ formatter: null }}
                                        />
                                    </div>

                                    <div className={styles.avatarCropActions}>
                                        <Button onClick={closeAvatarPreview} disabled={isUploadingAvatar}>
                                            Cancel
                                        </Button>
                                        <Button type="primary" onClick={handleSaveCroppedAvatar} loading={isUploadingAvatar}>
                                            Save avatar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.avatarPreviewImageWrap}>
                                        <UserAvatar user={user} className={styles.avatarPreviewImage} fallback="U" />
                                    </div>
                                    <div className={styles.avatarPreviewActions}>
                                        <Button
                                            icon={<EditOutlined />}
                                            onClick={handleEditCurrentAvatar}
                                            loading={isUploadingAvatar && !avatarCropUrl}
                                            disabled={!user?.avatar?.url}
                                        >
                                            Edit
                                        </Button>
                                        <Upload
                                            showUploadList={false}
                                            accept="image/jpeg,image/png,image/webp"
                                            beforeUpload={handleSelectAvatar}
                                            disabled={isUploadingAvatar}
                                        >
                                            <Button icon={<UploadOutlined />} loading={isUploadingAvatar}>
                                                Upload
                                            </Button>
                                        </Upload>
                                        <Button
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={handleDeleteAvatar}
                                            loading={isUploadingAvatar}
                                            disabled={!user?.avatar?.url}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className={styles.profileFormGrid}>
                        <label className={styles.profileInputGroup}>
                            <span>Display name</span>
                            <div className={styles.profileInputRow}>
                                <input
                                    value={usernameDraft}
                                    onChange={(event) => setUsernameDraft(event.target.value)}
                                    maxLength={30}
                                    placeholder="Display name"
                                />
                                <Button
                                    type="primary"
                                    onClick={handleSaveUsername}
                                    loading={isSavingUsername}
                                    disabled={usernameDraft.trim() === user?.username}
                                >
                                    Save
                                </Button>
                            </div>
                        </label>

                        <label className={styles.profileInputGroup}>
                            <span>User ID</span>
                            <div className={styles.profileInputRow}>
                                <input
                                    value={userIdDraft}
                                    onChange={(event) => setUserIdDraft(event.target.value.toLowerCase())}
                                    maxLength={30}
                                    placeholder="userid"
                                    autoCapitalize="none"
                                />
                                <Button
                                    type="primary"
                                    onClick={handleSaveUserId}
                                    loading={isSavingUserId}
                                    disabled={userIdDraft.trim().toLowerCase() === user?.userId}
                                >
                                    Save
                                </Button>
                            </div>
                            <small>People can find you with @{userIdDraft.trim().toLowerCase() || 'userid'}.</small>
                        </label>
                    </div>
                </div>
            </Modal>
        </nav>
    );
}
