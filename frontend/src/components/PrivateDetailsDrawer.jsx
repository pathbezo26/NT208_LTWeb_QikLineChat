import { useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Empty, List, Spin } from 'antd';
import {
    FileTextOutlined,
    FlagOutlined,
    LinkOutlined,
    StopOutlined,
    UndoOutlined,
} from '@ant-design/icons';
import { getConversationsAPI } from '../api/conversationAPI';
import UserAvatar from './UserAvatar';
import styles from './styles/PrivateDetailsDrawer.module.css';

const getUserId = (user) => {
    if (!user) return null;
    return typeof user === 'object' ? (user._id || user.id || user.toString?.()) : user;
};

const formatShortDate = (value) => {
    if (!value) return 'Unknown';

    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
};

const formatLastSeen = (lastSeenAt) => {
    if (!lastSeenAt) return 'Offline';

    const date = new Date(lastSeenAt);
    if (Number.isNaN(date.getTime())) return 'Offline';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);

    if (diffMinutes < 1) return 'Last seen just now';
    if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;

    return `Last seen ${formatShortDate(lastSeenAt)}`;
};

const formatFileSize = (size) => {
    if (!size) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const extractLinks = (messages = []) => {
    const linkPattern = /(https?:\/\/[^\s]+)/g;

    return messages.flatMap((message) => {
        const matches = (message.content || '').match(linkPattern) || [];

        return matches.map((url) => ({
            url,
            domain: (() => {
                try {
                    return new URL(url).hostname.replace(/^www\./, '');
                } catch {
                    return url;
                }
            })(),
            createdAt: message.createdAt,
        }));
    });
};

const getSharedAttachments = (messages = [], targetType) => {
    return messages.flatMap((message) => {
        const attachments = Array.isArray(message.attachments) ? message.attachments : [];

        return attachments
            .filter((attachment) => {
                return targetType === 'image'
                    ? attachment.type === 'image'
                    : attachment.type !== 'image';
            })
            .map((attachment) => ({
                ...attachment,
                messageId: message._id,
                createdAt: message.createdAt,
            }));
    });
};

export default function PrivateDetailsDrawer({
    open,
    onClose,
    conversation,
    currentUser,
    otherUser,
    presence,
    isBlocked,
    messages,
    onBlockToggle,
    onReportUser,
}) {
    const [activePanel, setActivePanel] = useState('overview');
    const [allConversations, setAllConversations] = useState([]);
    const [isLoadingConversations, setIsLoadingConversations] = useState(false);

    const currentUserId = currentUser?._id;
    const otherUserId = getUserId(otherUser);
    const statusText = presence?.online ? 'Online' : formatLastSeen(presence?.lastSeenAt || otherUser?.lastSeenAt);
    const photoItems = useMemo(() => getSharedAttachments(messages, 'image'), [messages]);
    const fileItems = useMemo(() => getSharedAttachments(messages, 'file'), [messages]);
    const linkItems = useMemo(() => extractLinks(messages), [messages]);
    const commonGroups = useMemo(() => {
        if (!currentUserId || !otherUserId) return [];

        return allConversations.filter((item) => {
            if (item.type !== 'group') return false;

            const memberIds = (item.members || []).map(getUserId);
            return memberIds.includes(currentUserId) && memberIds.includes(otherUserId);
        });
    }, [allConversations, currentUserId, otherUserId]);

    useEffect(() => {
        if (!open) return;

        setActivePanel('overview');
        let ignore = false;

        const loadCommonGroups = async () => {
            setIsLoadingConversations(true);
            try {
                const data = await getConversationsAPI();
                if (!ignore) setAllConversations(data || []);
            } catch (error) {
                console.error('Load common groups error:', error);
                if (!ignore) setAllConversations([]);
            } finally {
                if (!ignore) setIsLoadingConversations(false);
            }
        };

        loadCommonGroups();

        return () => {
            ignore = true;
        };
    }, [open]);

    if (!conversation || conversation.type !== 'private' || !otherUser) return null;

    const panels = [
        { key: 'overview', label: 'Info' },
        { key: 'groups', label: 'Groups' },
        { key: 'media', label: 'Media' },
        { key: 'files', label: 'Files' },
    ];

    return (
        <Drawer
            title="Chat info"
            open={open}
            onClose={onClose}
            width={420}
            className={styles.drawer}
        >
            <div className={styles.profile}>
                <UserAvatar user={otherUser} name={otherUser.username} className={styles.avatar} />
                <h2>{otherUser.username || 'User'}</h2>
                <span className={`${styles.status} ${presence?.online ? styles.online : ''}`}>
                    <span />
                    {statusText}
                </span>
                {otherUser.email && <p>{otherUser.email}</p>}
            </div>

            <div className={styles.quickActions}>
                <span
                    className={styles.quickActionBubble}
                    style={{ transform: `translateX(${panels.findIndex((item) => item.key === activePanel) * 100}%)` }}
                />
                {panels.map((item) => (
                    <button
                        className={activePanel === item.key ? styles.quickActionActive : ''}
                        type="button"
                        onClick={() => setActivePanel(item.key)}
                        key={item.key}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {activePanel === 'overview' && (
                <div className={styles.sectionStack}>
                    <div className={styles.infoList}>
                        <div className={styles.infoRow}>
                            <span>Username</span>
                            <strong>{otherUser.username || 'User'}</strong>
                        </div>
                        {otherUser.email && (
                            <div className={styles.infoRow}>
                                <span>Email</span>
                                <strong>{otherUser.email}</strong>
                            </div>
                        )}
                        <div className={styles.infoRow}>
                            <span>Status</span>
                            <strong>{statusText}</strong>
                        </div>
                    </div>

                    {(isLoadingConversations || commonGroups.length > 0) && (
                        <div className={styles.commonPreview}>
                            <div className={styles.sectionHeading}>
                                <span>Groups in common</span>
                                {commonGroups.length > 0 && <strong>{commonGroups.length}</strong>}
                            </div>
                            {isLoadingConversations ? (
                                <div className={styles.loading}><Spin size="small" /></div>
                            ) : (
                                <div className={styles.previewList}>
                                    {commonGroups.slice(0, 3).map((item) => (
                                        <button
                                            type="button"
                                            className={styles.previewRow}
                                            onClick={() => setActivePanel('groups')}
                                            key={item._id}
                                        >
                                            <UserAvatar
                                                name={item.name || 'Group'}
                                                src={item.avatar?.url}
                                                fallback="G"
                                                className={styles.resourceAvatar}
                                            />
                                            <span>
                                                <strong>{item.name || 'Group chat'}</strong>
                                                <small>{item.members?.length || 0} members</small>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activePanel === 'groups' && (
                <div className={styles.sectionStack}>
                    <div className={styles.sectionHeading}>
                        <span>Groups in common</span>
                        <strong>{commonGroups.length}</strong>
                    </div>
                    {isLoadingConversations ? (
                        <div className={styles.loading}><Spin size="small" /></div>
                    ) : commonGroups.length ? (
                        <List
                            className={styles.resourceList}
                            dataSource={commonGroups}
                            renderItem={(item) => (
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={(
                                            <UserAvatar
                                                name={item.name || 'Group'}
                                                src={item.avatar?.url}
                                                fallback="G"
                                                className={styles.resourceAvatar}
                                            />
                                        )}
                                        title={item.name || 'Group chat'}
                                        description={`${item.members?.length || 0} members`}
                                    />
                                </List.Item>
                            )}
                        />
                    ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No common groups" />
                    )}
                </div>
            )}

            {activePanel === 'media' && (
                <div className={styles.sectionStack}>
                    <div className={styles.sectionHeading}>
                        <span>Shared photos</span>
                        <strong>{photoItems.length}</strong>
                    </div>
                    {photoItems.length ? (
                        <div className={styles.photoGrid}>
                            {photoItems.map((item, index) => (
                                <a
                                    className={styles.photoTile}
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    key={`${item.url}-${index}`}
                                >
                                    <img src={item.url} alt={item.name || 'Shared photo'} />
                                </a>
                            ))}
                        </div>
                    ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No shared photos yet" />
                    )}
                </div>
            )}

            {activePanel === 'files' && (
                <div className={styles.sectionStack}>
                    <div className={styles.sectionHeading}>
                        <span>Files and links</span>
                        <strong>{fileItems.length + linkItems.length}</strong>
                    </div>

                    {fileItems.length > 0 && (
                        <List
                            className={styles.resourceList}
                            dataSource={fileItems}
                            renderItem={(item, index) => (
                                <List.Item key={`${item.url}-${index}`}>
                                    <a className={styles.fileRow} href={item.url} target="_blank" rel="noreferrer">
                                        <span className={styles.fileIcon}><FileTextOutlined /></span>
                                        <span className={styles.fileText}>
                                            <span className={styles.fileName}>{item.name || 'Attachment'}</span>
                                            <span className={styles.fileMeta}>{formatFileSize(item.size) || item.mimeType || 'File'}</span>
                                        </span>
                                    </a>
                                </List.Item>
                            )}
                        />
                    )}

                    {linkItems.length > 0 && (
                        <List
                            className={styles.resourceList}
                            dataSource={linkItems}
                            renderItem={(item, index) => (
                                <List.Item key={`${item.url}-${index}`}>
                                    <List.Item.Meta
                                        avatar={<span className={styles.linkIcon}><LinkOutlined /></span>}
                                        title={<a href={item.url} target="_blank" rel="noreferrer">{item.domain}</a>}
                                        description={formatShortDate(item.createdAt)}
                                    />
                                </List.Item>
                            )}
                        />
                    )}

                    {fileItems.length === 0 && linkItems.length === 0 && (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No files or links yet" />
                    )}
                </div>
            )}

            <div className={styles.dangerZone}>
                <div className={styles.dangerTitle}>Privacy and safety</div>
                <Button
                    danger
                    block
                    icon={isBlocked ? <UndoOutlined /> : <StopOutlined />}
                    onClick={() => onBlockToggle?.(otherUser, isBlocked)}
                >
                    {isBlocked ? 'Unblock user' : 'Block user'}
                </Button>
                <Button
                    danger
                    block
                    icon={<FlagOutlined />}
                    onClick={() => onReportUser?.(otherUser)}
                >
                    Report user
                </Button>
            </div>
        </Drawer>
    );
}
