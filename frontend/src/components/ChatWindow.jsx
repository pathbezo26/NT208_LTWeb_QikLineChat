import { useEffect, useState } from 'react';
import { Alert, Button, Drawer, Input, List, Spin } from 'antd';
import { DeleteOutlined, MessageOutlined, UserAddOutlined } from '@ant-design/icons';
import axiosInstance from '../api/axiosInstance';
import {
    addGroupMembersAPI,
    removeGroupMemberAPI,
} from '../api/conversationAPI';
import { getMessagesAPI } from '../api/messageAPI';
import useSocket from '../hooks/useSocket';
import useAuth from '../hooks/useAuth';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import UserAvatar from './UserAvatar';
import styles from './styles/ChatWindow.module.css';

export default function ChatWindow({ conversation, onConversationUpdated }) {
    const socket = useSocket();
    const { user } = useAuth();

    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);

    const [isMemberDrawerOpen, setIsMemberDrawerOpen] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [memberSearchResults, setMemberSearchResults] = useState([]);
    const [isSearchingMembers, setIsSearchingMembers] = useState(false);
    const [memberActionId, setMemberActionId] = useState(null);
    const [memberError, setMemberError] = useState('');

    useEffect(() => {
        if (!conversation) return;

        let ignore = false;

        const fetchMessages = async () => {
            setIsLoading(true);

            try {
                const data = await getMessagesAPI(conversation._id);
                if (!ignore) setMessages(data);
            } catch (error) {
                console.error('Load messages error:', error);
            } finally {
                if (!ignore) setIsLoading(false);
            }
        };

        setMessages([]);
        setTypingUsers([]);
        fetchMessages();

        return () => {
            ignore = true;
        };
    }, [conversation]);

    useEffect(() => {
        if (!socket || !conversation) return;

        socket.emit('joinRoom', conversation._id);

        return () => {
            socket.emit('leaveRoom', conversation._id);
        };
    }, [socket, conversation]);

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (newMessage) => {
            setMessages((prevMessages) => {
                const isMessageExist = prevMessages.find((msg) => msg._id === newMessage._id);
                if (isMessageExist) return prevMessages;

                return [...prevMessages, newMessage];
            });
        };

        socket.on('newMessage', handleNewMessage);

        return () => socket.off('newMessage', handleNewMessage);
    }, [socket]);

    useEffect(() => {
        if (!socket || !user) return;

        const handleUserTyping = ({ userId, username }) => {
            if (userId === user._id) return;

            setTypingUsers((prevUsers) => {
                const isAlreadyTyping = prevUsers.find((typingUser) => typingUser.userId === userId);
                if (isAlreadyTyping) return prevUsers;

                return [...prevUsers, { userId, username }];
            });
        };

        const handleUserStopTyping = ({ userId }) => {
            setTypingUsers((prevUsers) => {
                return prevUsers.filter((typingUser) => typingUser.userId !== userId);
            });
        };

        socket.on('typing', handleUserTyping);
        socket.on('stopTyping', handleUserStopTyping);

        return () => {
            socket.off('typing', handleUserTyping);
            socket.off('stopTyping', handleUserStopTyping);
        };
    }, [socket, user]);

    useEffect(() => {
        setIsMemberDrawerOpen(false);
        setMemberSearchQuery('');
        setMemberSearchResults([]);
        setMemberError('');
    }, [conversation?._id]);

    if (!conversation) {
        return (
            <div className={styles.empty}>
                <div className={styles.emptyIcon}>
                    <MessageOutlined />
                </div>
                <p>Select a conversation to get started</p>
                <span>Send a private message or create a group to chat with friends.</span>
            </div>
        );
    }

    const getOtherMember = () => {
        return conversation.members.find((member) => member._id !== user._id);
    };

    const getChatName = () => {
        if (conversation.type === 'group') {
            return conversation.name || 'Group chat';
        }

        return getOtherMember()?.username || 'User';
    };

    const getUserId = (targetUser) => {
        return typeof targetUser === 'object' ? targetUser._id : targetUser;
    };

    const isGroupOwner = getUserId(conversation.createdBy) === user._id;

    const resetMemberSearch = () => {
        setMemberSearchQuery('');
        setMemberSearchResults([]);
        setMemberError('');
    };

    const handleSearchMembers = async (e) => {
        const keyword = e.target.value;
        setMemberSearchQuery(keyword);

        if (!keyword.trim()) {
            setMemberSearchResults([]);
            setIsSearchingMembers(false);
            return;
        }

        setIsSearchingMembers(true);
        setMemberError('');

        try {
            const response = await axiosInstance.get(`/users/search?q=${encodeURIComponent(keyword)}`);
            const currentMemberIds = new Set(conversation.members.map((member) => member._id));
            const availableUsers = response.data.filter((searchUser) => !currentMemberIds.has(searchUser._id));

            setMemberSearchResults(availableUsers);
        } catch (error) {
            console.error('Search group members error:', error);
            setMemberSearchResults([]);
            setMemberError('Could not find users.');
        } finally {
            setIsSearchingMembers(false);
        }
    };

    const handleAddMember = async (member) => {
        setMemberActionId(member._id);
        setMemberError('');

        try {
            const data = await addGroupMembersAPI(conversation._id, [member._id]);
            onConversationUpdated(data.conversation);
            resetMemberSearch();
        } catch (error) {
            setMemberError(error.response?.data?.message || 'Could not add member.');
        } finally {
            setMemberActionId(null);
        }
    };

    const handleRemoveMember = async (member) => {
        setMemberActionId(member._id);
        setMemberError('');

        try {
            const data = await removeGroupMemberAPI(conversation._id, member._id);
            onConversationUpdated(data.conversation);
        } catch (error) {
            setMemberError(error.response?.data?.message || 'Could not remove member.');
        } finally {
            setMemberActionId(null);
        }
    };

    return (
        <div className={styles.window}>
            <div className={styles.header}>
                <UserAvatar
                    user={conversation.type === 'private' ? getOtherMember() : null}
                    name={conversation.type === 'group' ? (conversation.name || 'Group') : getChatName()}
                    src={conversation.type === 'group' ? conversation.avatar?.url : undefined}
                    className={styles.headerAvatar}
                    fallback={conversation.type === 'group' ? 'G' : '?'}
                />

                <div className={styles.headerInfo}>
                    <span className={styles.headerName}>{getChatName()}</span>
                    {conversation.type === 'group' && (
                        <button
                            className={styles.memberCount}
                            onClick={() => setIsMemberDrawerOpen(true)}
                            type="button"
                        >
                            {conversation.members.length} members
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className={styles.loading}>Loading messages...</div>
            ) : (
                <MessageList messages={messages} currentUserId={user._id} />
            )}

            {typingUsers.length > 0 && (
                <div className={styles.typing}>
                    {typingUsers.map((typingUser) => typingUser.username).join(', ')} typing...
                </div>
            )}

            <ChatInput conversationId={conversation._id} />

            <Drawer
                title="Group members"
                open={isMemberDrawerOpen}
                onClose={() => setIsMemberDrawerOpen(false)}
                width={360}
            >
                {memberError && (
                    <Alert
                        type="error"
                        message={memberError}
                        showIcon
                        style={{ marginBottom: 12 }}
                    />
                )}

                <Input
                    prefix={<UserAddOutlined />}
                    value={memberSearchQuery}
                    onChange={handleSearchMembers}
                    placeholder="Search people to add to the group"
                    allowClear
                    style={{ marginBottom: 12 }}
                />

                {isSearchingMembers && (
                    <Spin size="small" style={{ marginBottom: 12 }} />
                )}

                {memberSearchResults.length > 0 && (
                    <List
                        size="small"
                        dataSource={memberSearchResults}
                        style={{ marginBottom: 18 }}
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
                                    avatar={<UserAvatar user={searchUser} className={styles.drawerAvatar} />}
                                    title={searchUser.username}
                                />
                            </List.Item>
                        )}
                    />
                )}

                <List
                    size="small"
                    dataSource={conversation.members}
                    renderItem={(member) => {
                        const canRemoveMember = isGroupOwner && member._id !== user._id;

                        return (
                            <List.Item
                                actions={canRemoveMember ? [
                                    <Button
                                        key="remove"
                                        danger
                                        type="text"
                                        icon={<DeleteOutlined />}
                                        loading={memberActionId === member._id}
                                        onClick={() => handleRemoveMember(member)}
                                    />,
                                ] : []}
                            >
                                <List.Item.Meta
                                    avatar={<UserAvatar user={member} className={styles.drawerAvatar} />}
                                    title={member.username}
                                />
                            </List.Item>
                        );
                    }}
                />
            </Drawer>
        </div>
    );
}
