import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CheckOutlined,
    CloseOutlined,
    ContactsOutlined,
    DeleteOutlined,
    MessageOutlined,
    SearchOutlined,
    UserAddOutlined,
} from '@ant-design/icons';
import { message as antdMessage } from 'antd';
import { createConversationAPI } from '../api/conversationAPI';
import {
    acceptContactRequestAPI,
    cancelContactRequestAPI,
    declineContactRequestAPI,
    getContactsAPI,
    removeContactAPI,
} from '../api/userAPI';
import useSocket from '../hooks/useSocket';
import UserAvatar from './UserAvatar';
import styles from './styles/ContactsWorkspace.module.css';

const contactTabs = [
    { id: 'contacts', label: 'Friends' },
    { id: 'requests', label: 'Requests' },
    { id: 'sent', label: 'Sent' },
];

const normalizeText = (value = '') => value.toLowerCase().trim();

export default function ContactsWorkspace({ onOpenConversation }) {
    const socket = useSocket();
    const [messageApi, contextHolder] = antdMessage.useMessage();
    const [contactsState, setContactsState] = useState({
        contacts: [],
        incomingRequests: [],
        outgoingRequests: [],
    });
    const [activeTab, setActiveTab] = useState('contacts');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [actionId, setActionId] = useState('');

    const loadContacts = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getContactsAPI();
            setContactsState({
                contacts: data.contacts || [],
                incomingRequests: data.incomingRequests || [],
                outgoingRequests: data.outgoingRequests || [],
            });
        } catch (error) {
            console.error('Load contact workspace error:', error);
            messageApi.error('Could not load contacts.');
        } finally {
            setIsLoading(false);
        }
    }, [messageApi]);

    useEffect(() => {
        loadContacts();
    }, [loadContacts]);

    useEffect(() => {
        if (!socket) return undefined;

        socket.on('contactRequestReceived', loadContacts);
        socket.on('contactRequestAccepted', loadContacts);
        socket.on('contactRequestDeclined', loadContacts);
        socket.on('contactRequestCancelled', loadContacts);
        socket.on('contactRemoved', loadContacts);

        return () => {
            socket.off('contactRequestReceived', loadContacts);
            socket.off('contactRequestAccepted', loadContacts);
            socket.off('contactRequestDeclined', loadContacts);
            socket.off('contactRequestCancelled', loadContacts);
            socket.off('contactRemoved', loadContacts);
        };
    }, [socket, loadContacts]);

    const filteredContacts = useMemo(() => {
        const keyword = normalizeText(searchQuery);
        if (!keyword) return contactsState.contacts;

        return contactsState.contacts.filter((contact) => {
            return normalizeText(`${contact.username} ${contact.email}`).includes(keyword);
        });
    }, [contactsState.contacts, searchQuery]);

    const stats = [
        { label: 'Friends', value: contactsState.contacts.length },
        { label: 'Requests', value: contactsState.incomingRequests.length },
        { label: 'Sent', value: contactsState.outgoingRequests.length },
    ];

    const openChat = async (contact) => {
        setActionId(contact._id);

        try {
            const conversation = await createConversationAPI({
                type: 'private',
                members: [contact._id],
            });
            onOpenConversation?.(conversation);
        } catch (error) {
            messageApi.error(error.response?.data?.message || 'Could not open chat.');
        } finally {
            setActionId('');
        }
    };

    const acceptRequest = async (request) => {
        setActionId(request._id);

        try {
            await acceptContactRequestAPI(request._id);
            messageApi.success('Contact added.');
            await loadContacts();
            setActiveTab('contacts');
        } catch (error) {
            messageApi.error(error.response?.data?.message || 'Could not accept request.');
        } finally {
            setActionId('');
        }
    };

    const declineRequest = async (request) => {
        setActionId(request._id);

        try {
            await declineContactRequestAPI(request._id);
            await loadContacts();
        } catch (error) {
            messageApi.error(error.response?.data?.message || 'Could not decline request.');
        } finally {
            setActionId('');
        }
    };

    const cancelRequest = async (request) => {
        setActionId(request._id);

        try {
            await cancelContactRequestAPI(request._id);
            await loadContacts();
        } catch (error) {
            messageApi.error(error.response?.data?.message || 'Could not cancel request.');
        } finally {
            setActionId('');
        }
    };

    const removeContact = async (contact) => {
        setActionId(contact._id);

        try {
            await removeContactAPI(contact._id);
            messageApi.success('Contact removed.');
            await loadContacts();
        } catch (error) {
            messageApi.error(error.response?.data?.message || 'Could not remove contact.');
        } finally {
            setActionId('');
        }
    };

    const renderContactRows = () => {
        if (isLoading) {
            return [0, 1, 2, 3].map((item) => (
                <div className={styles.skeletonRow} key={item}>
                    <span className={styles.skeletonAvatar} />
                    <span className={styles.skeletonText}>
                        <span />
                        <small />
                    </span>
                </div>
            ));
        }

        if (activeTab === 'requests') {
            if (contactsState.incomingRequests.length === 0) {
                return <EmptyState title="No pending requests" text="Incoming contact requests will appear here." />;
            }

            return contactsState.incomingRequests.map((request) => (
                <ContactRow
                    key={request._id}
                    user={request.otherUser}
                    meta="Wants to connect"
                    actions={(
                        <>
                            <button
                                className={styles.primaryIconButton}
                                type="button"
                                onClick={() => acceptRequest(request)}
                                disabled={actionId === request._id}
                                aria-label="Accept request"
                                title="Accept"
                            >
                                <CheckOutlined />
                            </button>
                            <button
                                className={styles.iconButton}
                                type="button"
                                onClick={() => declineRequest(request)}
                                disabled={actionId === request._id}
                                aria-label="Decline request"
                                title="Decline"
                            >
                                <CloseOutlined />
                            </button>
                        </>
                    )}
                />
            ));
        }

        if (activeTab === 'sent') {
            if (contactsState.outgoingRequests.length === 0) {
                return <EmptyState title="No sent requests" text="Requests you send will stay here until answered." />;
            }

            return contactsState.outgoingRequests.map((request) => (
                <ContactRow
                    key={request._id}
                    user={request.otherUser}
                    meta="Waiting for response"
                    actions={(
                        <button
                            className={styles.textButton}
                            type="button"
                            onClick={() => cancelRequest(request)}
                            disabled={actionId === request._id}
                        >
                            Cancel
                        </button>
                    )}
                />
            ));
        }

        if (filteredContacts.length === 0) {
            return (
                <EmptyState
                    title={searchQuery.trim() ? 'No matching contacts' : 'No contacts yet'}
                    text={searchQuery.trim() ? 'Try another name or email.' : 'Use the sidebar search to send a contact request.'}
                />
            );
        }

        return filteredContacts.map((contact) => (
            <ContactRow
                key={contact._id}
                user={contact}
                meta={contact.email}
                actions={(
                    <>
                        <button
                            className={styles.primaryIconButton}
                            type="button"
                            onClick={() => openChat(contact)}
                            disabled={actionId === contact._id}
                            aria-label={`Message ${contact.username}`}
                            title="Message"
                        >
                            <MessageOutlined />
                        </button>
                        <button
                            className={styles.iconButton}
                            type="button"
                            onClick={() => removeContact(contact)}
                            disabled={actionId === contact._id}
                            aria-label={`Remove ${contact.username}`}
                            title="Remove"
                        >
                            <DeleteOutlined />
                        </button>
                    </>
                )}
            />
        ));
    };

    return (
        <main className={styles.workspace}>
            {contextHolder}
            <header className={styles.header}>
                <div className={styles.titleBlock}>
                    <span className={styles.titleIcon}>
                        <ContactsOutlined />
                    </span>
                    <div>
                        <p>Contacts</p>
                        <h1>Friends and requests</h1>
                    </div>
                </div>
                <div className={styles.stats}>
                    {stats.map((item) => (
                        <span key={item.label}>
                            <strong>{item.value}</strong>
                            {item.label}
                        </span>
                    ))}
                </div>
            </header>

            <section className={styles.panel}>
                <div className={styles.toolbar}>
                    <div className={styles.searchBox}>
                        <SearchOutlined />
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search friends"
                            disabled={activeTab !== 'contacts'}
                        />
                    </div>
                    <div className={styles.tabs} role="tablist" aria-label="Contact views">
                        {contactTabs.map((tab) => (
                            <button
                                key={tab.id}
                                className={activeTab === tab.id ? styles.activeTab : ''}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.listHeader}>
                    <span>
                        {activeTab === 'contacts' && `Friends (${filteredContacts.length})`}
                        {activeTab === 'requests' && `Incoming requests (${contactsState.incomingRequests.length})`}
                        {activeTab === 'sent' && `Sent requests (${contactsState.outgoingRequests.length})`}
                    </span>
                    <small>{activeTab === 'contacts' ? 'Open a chat or manage a friend' : 'Review contact activity'}</small>
                </div>

                <div className={styles.list}>{renderContactRows()}</div>
            </section>
        </main>
    );
}

function ContactRow({ user, meta, actions }) {
    return (
        <article className={styles.row}>
            <UserAvatar user={user} className={styles.avatar} fallback="U" />
            <div className={styles.rowText}>
                <strong>{user?.username || 'Unknown user'}</strong>
                <span>{meta}</span>
            </div>
            <div className={styles.rowActions}>{actions}</div>
        </article>
    );
}

function EmptyState({ title, text }) {
    return (
        <div className={styles.emptyState}>
            <span>
                <UserAddOutlined />
            </span>
            <strong>{title}</strong>
            <p>{text}</p>
        </div>
    );
}
