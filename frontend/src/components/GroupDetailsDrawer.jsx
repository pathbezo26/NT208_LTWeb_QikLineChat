import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Drawer, Empty, Input, List, Modal, Select, Spin, Tabs, message as antdMessage } from 'antd';
import {
    CameraOutlined,
    CopyOutlined,
    CrownOutlined,
    DeleteOutlined,
    EditOutlined,
    ExclamationCircleOutlined,
    FileTextOutlined,
    LinkOutlined,
    LogoutOutlined,
    TeamOutlined,
    UserAddOutlined,
} from '@ant-design/icons';
import axiosInstance from '../api/axiosInstance';
import {
    addGroupMembersAPI,
    leaveGroupAPI,
    removeGroupMemberAPI,
    updateGroupAdminsAPI,
    updateGroupDetailsAPI,
    uploadGroupAvatarAPI,
} from '../api/conversationAPI';
import UserAvatar from './UserAvatar';
import styles from './styles/GroupDetailsDrawer.module.css';

const getUserId = (user) => {
    if (!user) return null;
    return typeof user === 'object' ? (user._id || user.id || user.toString?.()) : user;
};

const formatFileSize = (size) => {
    if (!size) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatShortDate = (value) => {
    if (!value) return '';

    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
    }).format(new Date(value));
};

const extractLinks = (messages = []) => {
    const linkPattern = /(https?:\/\/[^\s]+)/g;

    return messages.flatMap((message) => {
        const content = message.content || '';
        const matches = content.match(linkPattern) || [];

        return matches.map((url) => ({
            url,
            domain: (() => {
                try {
                    return new URL(url).hostname.replace(/^www\./, '');
                } catch {
                    return url;
                }
            })(),
            senderName: message.sender?.username || 'Unknown',
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
                senderName: message.sender?.username || 'Unknown',
                createdAt: message.createdAt,
            }));
    });
};

export default function GroupDetailsDrawer({
    open,
    onClose,
    conversation,
    currentUser,
    messages,
    onConversationUpdated,
    onConversationLeft,
}) {
    const [messageApi, contextHolder] = antdMessage.useMessage();
    const avatarInputRef = useRef(null);
    const [activeTab, setActiveTab] = useState('members');
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [memberSearchResults, setMemberSearchResults] = useState([]);
    const [isSearchingMembers, setIsSearchingMembers] = useState(false);
    const [memberActionId, setMemberActionId] = useState(null);
    const [panelError, setPanelError] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [groupName, setGroupName] = useState(conversation?.name || '');
    const [isSavingName, setIsSavingName] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [leaveOwnerId, setLeaveOwnerId] = useState(null);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [isConfirming, setIsConfirming] = useState(false);

    const currentUserId = currentUser?._id;
    const ownerId = getUserId(conversation?.createdBy);
    const members = Array.isArray(conversation?.members) ? conversation.members : [];
    const adminIds = useMemo(() => {
        return new Set((Array.isArray(conversation?.admins) ? conversation.admins : []).map(getUserId));
    }, [conversation?.admins]);
    const isGroupOwner = ownerId === currentUserId;
    const isCurrentUserAdmin = adminIds.has(currentUserId);
    const canManageGroup = isGroupOwner || isCurrentUserAdmin;
    const adminCount = adminIds.size + (ownerId ? 1 : 0);
    const photoItems = useMemo(() => getSharedAttachments(messages, 'image'), [messages]);
    const fileItems = useMemo(() => getSharedAttachments(messages, 'file'), [messages]);
    const linkItems = useMemo(() => extractLinks(messages), [messages]);

    useEffect(() => {
        if (!open) return;

        setGroupName(conversation?.name || '');
        setPanelError('');
        setMemberSearchQuery('');
        setMemberSearchResults([]);
        setIsEditingName(false);
        setLeaveOwnerId(null);
        setIsLeaveModalOpen(false);
        setConfirmDialog(null);
    }, [conversation?._id, conversation?.name, open]);

    const resetMemberSearch = () => {
        setMemberSearchQuery('');
        setMemberSearchResults([]);
        setPanelError('');
    };

    const handleSearchMembers = async (event) => {
        const keyword = event.target.value;
        setMemberSearchQuery(keyword);

        if (!keyword.trim()) {
            setMemberSearchResults([]);
            setIsSearchingMembers(false);
            return;
        }

        setIsSearchingMembers(true);
        setPanelError('');

        try {
            const response = await axiosInstance.get(`/users/search?q=${encodeURIComponent(keyword)}`);
            const currentMemberIds = new Set(members.map(getUserId));
            const availableUsers = response.data.filter((searchUser) => !currentMemberIds.has(searchUser._id));

            setMemberSearchResults(availableUsers);
        } catch (error) {
            console.error('Search group members error:', error);
            setMemberSearchResults([]);
            setPanelError('Could not find users.');
        } finally {
            setIsSearchingMembers(false);
        }
    };

    const handleAddMember = async (member) => {
        setMemberActionId(member._id);
        setPanelError('');

        try {
            const data = await addGroupMembersAPI(conversation._id, [member._id]);
            onConversationUpdated(data.conversation);
            resetMemberSearch();
            messageApi.success('Member added.');
        } catch (error) {
            setPanelError(error.response?.data?.message || 'Could not add member.');
        } finally {
            setMemberActionId(null);
        }
    };

    const handleRemoveMember = (member) => {
        setConfirmDialog({
            title: `Remove ${member.username || 'this member'}?`,
            description: 'They will no longer be able to read or send messages in this group.',
            confirmText: 'Remove member',
            danger: true,
            onConfirm: async () => {
                setMemberActionId(member._id);
                setPanelError('');

                try {
                    const data = await removeGroupMemberAPI(conversation._id, member._id);
                    onConversationUpdated(data.conversation);
                    messageApi.success('Member removed.');
                } catch (error) {
                    setPanelError(error.response?.data?.message || 'Could not remove member.');
                } finally {
                    setMemberActionId(null);
                }
            },
        });
    };

    const handleUpdateAdmin = (member, action) => {
        const isAdding = action === 'add';
        setConfirmDialog({
            title: `${isAdding ? 'Make' : 'Remove'} ${member.username || 'this member'} ${isAdding ? 'admin' : 'from admins'}?`,
            description: isAdding
                ? 'Admins can update group info, add members, and remove regular members.'
                : 'This member will lose group management permissions.',
            confirmText: isAdding ? 'Make admin' : 'Remove admin',
            danger: !isAdding,
            onConfirm: async () => {
                const memberId = getUserId(member);
                setMemberActionId(memberId);
                setPanelError('');

                try {
                    const data = await updateGroupAdminsAPI(conversation._id, [memberId], action);
                    onConversationUpdated(data.conversation);
                    messageApi.success(isAdding ? 'Admin added.' : 'Admin removed.');
                } catch (error) {
                    setPanelError(error.response?.data?.message || 'Could not update admin permissions.');
                } finally {
                    setMemberActionId(null);
                }
            },
        });
    };

    const handleSaveName = async () => {
        const nextName = groupName.trim();
        if (!nextName) {
            setPanelError('Group name is required.');
            return;
        }

        setIsSavingName(true);
        setPanelError('');

        try {
            const data = await updateGroupDetailsAPI(conversation._id, { name: nextName });
            onConversationUpdated(data.conversation);
            setIsEditingName(false);
            messageApi.success('Group name updated.');
        } catch (error) {
            setPanelError(error.response?.data?.message || 'Could not update group name.');
        } finally {
            setIsSavingName(false);
        }
    };

    const handleAvatarChange = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setIsUploadingAvatar(true);
        setPanelError('');

        try {
            const data = await uploadGroupAvatarAPI(conversation._id, file);
            onConversationUpdated(data.conversation);
            messageApi.success('Group photo updated.');
        } catch (error) {
            setPanelError(error.response?.data?.message || 'Could not update group photo.');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleLeaveGroup = () => {
        if (isGroupOwner && members.length > 1) {
            const fallbackOwnerId = members.find((member) => getUserId(member) !== currentUserId);
            setLeaveOwnerId(getUserId(fallbackOwnerId));
            setIsLeaveModalOpen(true);
            return;
        }

        setConfirmDialog({
            title: 'Leave this group?',
            description: 'The conversation will be removed from your list.',
            confirmText: 'Leave group',
            danger: true,
            onConfirm: async () => {
                setIsLeaving(true);
                setPanelError('');

                try {
                    await leaveGroupAPI(conversation._id);
                    messageApi.success('You left the group.');
                    onConversationLeft(conversation._id);
                    onClose();
                } catch (error) {
                    setPanelError(error.response?.data?.message || 'Could not leave group.');
                } finally {
                    setIsLeaving(false);
                }
            },
        });
    };

    const handleConfirmDialogOk = async () => {
        if (!confirmDialog?.onConfirm) return;

        setIsConfirming(true);

        try {
            await confirmDialog.onConfirm();
            setConfirmDialog(null);
        } finally {
            setIsConfirming(false);
        }
    };

    const handleConfirmOwnerLeave = async () => {
        if (!leaveOwnerId) {
            setPanelError('Choose a new owner before leaving.');
            return;
        }

        setIsLeaving(true);
        setPanelError('');

        try {
            await leaveGroupAPI(conversation._id, leaveOwnerId);
            messageApi.success('You left the group.');
            setIsLeaveModalOpen(false);
            onConversationLeft(conversation._id);
            onClose();
        } catch (error) {
            setPanelError(error.response?.data?.message || 'Could not leave group.');
        } finally {
            setIsLeaving(false);
        }
    };

    const handleCopyLink = async (url) => {
        try {
            await navigator.clipboard.writeText(url);
            messageApi.success('Link copied.');
        } catch {
            messageApi.error('Could not copy link.');
        }
    };

    if (!conversation || conversation.type !== 'group') return null;

    const quickActions = [
        { key: 'members', label: 'Members' },
        { key: 'photos', label: 'Media' },
        { key: 'files', label: 'Files' },
        { key: 'links', label: 'Links' },
    ];

    const tabItems = [
        {
            key: 'members',
            label: 'Members',
            children: (
                <div className={styles.sectionStack}>
                    <div className={styles.sectionHeading}>
                        <span>People</span>
                        <strong>{members.length} members</strong>
                    </div>

                    {canManageGroup && (
                        <Input
                            className={styles.memberSearch}
                            prefix={<UserAddOutlined />}
                            value={memberSearchQuery}
                            onChange={handleSearchMembers}
                            placeholder="Search people to add"
                            allowClear
                        />
                    )}

                    {canManageGroup && isSearchingMembers && <Spin size="small" />}

                    {canManageGroup && memberSearchResults.length > 0 && (
                        <List
                            className={styles.searchResults}
                            size="small"
                            dataSource={memberSearchResults}
                            renderItem={(searchUser) => (
                                <List.Item
                                    actions={[
                                        <Button
                                            key="add"
                                            type="link"
                                            loading={memberActionId === searchUser._id}
                                            onClick={() => handleAddMember(searchUser)}
                                        >
                                            Add
                                        </Button>,
                                    ]}
                                >
                                    <List.Item.Meta
                                        avatar={<UserAvatar user={searchUser} className={styles.memberAvatar} />}
                                        title={searchUser.username}
                                    />
                                </List.Item>
                            )}
                        />
                    )}

                    <List
                        className={styles.memberList}
                        dataSource={members}
                        renderItem={(member) => {
                            const memberId = getUserId(member);
                            const isCurrentUser = memberId === currentUserId;
                            const isOwner = memberId === ownerId;
                            const isAdmin = adminIds.has(memberId);
                            const canRemoveMember = canManageGroup
                                && !isCurrentUser
                                && !isOwner
                                && (isGroupOwner || !isAdmin);
                            const canAddAdmin = isGroupOwner && !isCurrentUser && !isOwner && !isAdmin;
                            const canRemoveAdmin = isGroupOwner && !isCurrentUser && isAdmin;

                            return (
                                <List.Item
                                    actions={[
                                        canAddAdmin && (
                                            <Button
                                                key="admin"
                                                type="text"
                                                icon={<CrownOutlined />}
                                                loading={memberActionId === memberId}
                                                onClick={() => handleUpdateAdmin(member, 'add')}
                                                title="Make admin"
                                            />
                                        ),
                                        canRemoveAdmin && (
                                            <Button
                                                key="remove-admin"
                                                type="text"
                                                icon={<CrownOutlined />}
                                                loading={memberActionId === memberId}
                                                onClick={() => handleUpdateAdmin(member, 'remove')}
                                                title="Remove admin"
                                            />
                                        ),
                                        canRemoveMember && (
                                            <Button
                                                key="remove"
                                                danger
                                                type="text"
                                                icon={<DeleteOutlined />}
                                                loading={memberActionId === memberId}
                                                onClick={() => handleRemoveMember(member)}
                                                title="Remove member"
                                            />
                                        ),
                                    ].filter(Boolean)}
                                >
                                    <List.Item.Meta
                                        avatar={<UserAvatar user={member} className={styles.memberAvatar} />}
                                        title={(
                                            <span className={styles.memberTitle}>
                                                {member.username || 'Member'}
                                                {isCurrentUser && <span className={styles.youBadge}>You</span>}
                                                {isOwner && <span className={styles.ownerBadge}>Owner</span>}
                                                {isAdmin && !isOwner && <span className={styles.adminBadge}>Admin</span>}
                                            </span>
                                        )}
                                        description={isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member'}
                                    />
                                </List.Item>
                            );
                        }}
                    />
                </div>
            ),
        },
        {
            key: 'photos',
            label: `Photos (${photoItems.length})`,
            children: photoItems.length ? (
                <div className={styles.mediaPanel}>
                    <div className={styles.sectionHeading}>
                        <span>Shared photos</span>
                        <strong>{photoItems.length}</strong>
                    </div>
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
                </div>
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No shared photos yet" />
            ),
        },
        {
            key: 'files',
            label: `Files (${fileItems.length})`,
            children: fileItems.length ? (
                <List
                    className={styles.resourceList}
                    dataSource={fileItems}
                    renderItem={(item, index) => (
                        <List.Item key={`${item.url}-${index}`}>
                            <a className={styles.fileRow} href={item.url} target="_blank" rel="noreferrer">
                                <span className={styles.fileIcon}><FileTextOutlined /></span>
                                <span className={styles.fileText}>
                                    <span className={styles.fileName}>{item.name || 'Attachment'}</span>
                                    <span className={styles.fileMeta}>
                                        {formatFileSize(item.size) || item.mimeType || 'File'} · {item.senderName} · {formatShortDate(item.createdAt)}
                                    </span>
                                </span>
                            </a>
                        </List.Item>
                    )}
                />
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No shared files yet" />
            ),
        },
        {
            key: 'links',
            label: `Links (${linkItems.length})`,
            children: linkItems.length ? (
                <List
                    className={styles.resourceList}
                    dataSource={linkItems}
                    renderItem={(item, index) => (
                        <List.Item
                            key={`${item.url}-${index}`}
                            actions={[
                                <Button
                                    key="copy"
                                    type="text"
                                    icon={<CopyOutlined />}
                                    onClick={() => handleCopyLink(item.url)}
                                />,
                            ]}
                        >
                            <List.Item.Meta
                                avatar={<span className={styles.linkIcon}><LinkOutlined /></span>}
                                title={<a href={item.url} target="_blank" rel="noreferrer">{item.domain}</a>}
                                description={`${item.senderName} · ${formatShortDate(item.createdAt)}`}
                            />
                        </List.Item>
                    )}
                />
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No shared links yet" />
            ),
        },
    ];

    return (
        <Drawer
            title="Group space"
            open={open}
            onClose={onClose}
            width={440}
            className={styles.drawer}
        >
            {contextHolder}
            <div className={styles.profile}>
                <div className={styles.avatarWrap}>
                    <UserAvatar
                        name={conversation.name || 'Group'}
                        src={conversation.avatar?.url}
                        className={styles.groupAvatar}
                        fallback="G"
                    />
                    {canManageGroup && (
                        <>
                            <button
                                className={styles.avatarButton}
                                type="button"
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={isUploadingAvatar}
                                title="Change group photo"
                            >
                                <CameraOutlined />
                            </button>
                            <input
                                ref={avatarInputRef}
                                className={styles.hiddenInput}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleAvatarChange}
                            />
                        </>
                    )}
                </div>

                {isEditingName ? (
                    <div className={styles.nameEditor}>
                        <Input
                            value={groupName}
                            onChange={(event) => setGroupName(event.target.value)}
                            onPressEnter={handleSaveName}
                            maxLength={80}
                        />
                        <Button type="primary" loading={isSavingName} onClick={handleSaveName}>Save</Button>
                        <Button onClick={() => setIsEditingName(false)}>Cancel</Button>
                    </div>
                ) : (
                    <div className={styles.nameRow}>
                        <h2>{conversation.name || 'Group chat'}</h2>
                        {canManageGroup && (
                            <Button
                                type="text"
                                icon={<EditOutlined />}
                                onClick={() => setIsEditingName(true)}
                                title="Edit group name"
                            />
                        )}
                    </div>
                )}

                <div className={styles.groupMeta}>
                    <span><TeamOutlined /> {members.length} members</span>
                    {isGroupOwner && <span><CrownOutlined /> You are owner</span>}
                    {!isGroupOwner && isCurrentUserAdmin && <span><CrownOutlined /> You are admin</span>}
                    {!isGroupOwner && !isCurrentUserAdmin && <span>Owner managed group</span>}
                </div>

                <div className={styles.groupStats}>
                    <span>
                        <strong>{photoItems.length + fileItems.length}</strong>
                        Media
                    </span>
                    <span>
                        <strong>{adminCount}</strong>
                        Leads
                    </span>
                    <span>
                        <strong>{linkItems.length}</strong>
                        Links
                    </span>
                </div>
            </div>

            {panelError && (
                <Alert
                    className={styles.alert}
                    type="error"
                    message={panelError}
                    showIcon
                />
            )}

            <div className={styles.quickActions}>
                <span
                    className={styles.quickActionBubble}
                    style={{ transform: `translateX(${quickActions.findIndex((item) => item.key === activeTab) * 100}%)` }}
                />
                {quickActions.map((item) => (
                    <button
                        className={activeTab === item.key ? styles.quickActionActive : ''}
                        type="button"
                        onClick={() => setActiveTab(item.key)}
                        key={item.key}
                    >
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
            />

            <div className={styles.dangerZone}>
                <Button
                    danger
                    block
                    icon={<LogoutOutlined />}
                    loading={isLeaving}
                    onClick={handleLeaveGroup}
                >
                    Leave group
                </Button>
            </div>

            <Modal
                centered
                open={Boolean(confirmDialog)}
                onCancel={() => setConfirmDialog(null)}
                footer={null}
                closable={false}
                width={390}
                className={styles.actionConfirmModal}
            >
                <div className={styles.confirmPanel}>
                    <span className={`${styles.confirmIcon} ${confirmDialog?.danger ? styles.confirmIconDanger : styles.confirmIconPrimary}`}>
                        <ExclamationCircleOutlined />
                    </span>
                    <div className={styles.confirmCopy}>
                        <h3>{confirmDialog?.title}</h3>
                        <p>{confirmDialog?.description}</p>
                    </div>
                    <div className={styles.confirmActions}>
                        <Button
                            className={styles.confirmCancel}
                            onClick={() => setConfirmDialog(null)}
                            disabled={isConfirming}
                        >
                            Cancel
                        </Button>
                        <Button
                            className={confirmDialog?.danger ? styles.confirmDanger : styles.confirmPrimary}
                            type={confirmDialog?.danger ? 'default' : 'primary'}
                            loading={isConfirming}
                            onClick={handleConfirmDialogOk}
                        >
                            {confirmDialog?.confirmText || 'Confirm'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                title="Choose a new owner"
                open={isLeaveModalOpen}
                onCancel={() => setIsLeaveModalOpen(false)}
                onOk={handleConfirmOwnerLeave}
                okText="Leave group"
                okButtonProps={{ danger: true, disabled: !leaveOwnerId }}
                confirmLoading={isLeaving}
            >
                <p className={styles.modalText}>
                    You are the owner. Pick a member to become owner before you leave.
                </p>
                <Select
                    className={styles.ownerSelect}
                    value={leaveOwnerId}
                    onChange={setLeaveOwnerId}
                    options={members
                        .filter((member) => getUserId(member) !== currentUserId)
                        .map((member) => ({
                            value: getUserId(member),
                            label: member.username || 'Member',
                        }))}
                    placeholder="Choose new owner"
                />
            </Modal>
        </Drawer>
    );
}
