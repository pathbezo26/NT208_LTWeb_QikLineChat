import { useEffect, useState } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import AppNavRail from '../components/AppNavRail';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import styles from './styles/ChatPage.module.css';

const THEME_STORAGE_KEY = 'qikline-theme';

export default function ChatPage() {
    const [activeSection, setActiveSection] = useState('messages');
    const [activeConversation, setActiveConversation] = useState(null);
    const [optimisticConversationUpdate, setOptimisticConversationUpdate] = useState(null);
    const [syncedConversationUpdate, setSyncedConversationUpdate] = useState(null);
    const [removedConversation, setRemovedConversation] = useState(null);
    const [navBadges, setNavBadges] = useState({
        unreadMessages: 0,
        incomingContacts: 0,
    });
    const [colorMode, setColorMode] = useState(() => {
        return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
    });

    const isDarkMode = colorMode === 'dark';

    useEffect(() => {
        localStorage.setItem(THEME_STORAGE_KEY, colorMode);
        document.documentElement.dataset.theme = colorMode;
    }, [colorMode]);

    const handleConversationUpdated = (updatedConversation) => {
        setActiveConversation(updatedConversation);
        if (updatedConversation?._id) {
            setSyncedConversationUpdate({
                conversation: updatedConversation,
                eventId: Date.now(),
            });
        }
    };

    const handleConversationPreviewUpdate = (previewUpdate) => {
        setOptimisticConversationUpdate({
            ...previewUpdate,
            eventId: Date.now(),
        });

        setActiveConversation((currentConversation) => {
            if (currentConversation?._id !== previewUpdate.conversationId) return currentConversation;

            return {
                ...currentConversation,
                updatedAt: previewUpdate.createdAt,
                lastMessage: {
                    messageId: previewUpdate.clientMessageId,
                    sender: previewUpdate.sender,
                    content: previewUpdate.content,
                    createdAt: previewUpdate.createdAt,
                },
            };
        });
    };

    const handleConversationLeft = (conversationId) => {
        setActiveConversation(null);
        setRemovedConversation({
            conversationId,
            eventId: Date.now(),
        });
    };

    return (
        <ConfigProvider
            theme={{
                algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: {
                    colorSuccess: isDarkMode ? '#8aa4c3' : '#2a5fa6',
                    colorSuccessBg: isDarkMode ? '#172233' : '#eef6ff',
                    colorSuccessBorder: isDarkMode ? '#32445d' : '#cfe4ff',
                    colorSuccessHover: isDarkMode ? '#9bb4d0' : '#1f5fae',
                },
            }}
        >
            <div className={styles.layout} data-theme={colorMode}>
                <AppNavRail
                    activeSection={activeSection}
                    onSectionChange={setActiveSection}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={() => setColorMode(isDarkMode ? 'light' : 'dark')}
                    badges={navBadges}
                />
                <Sidebar
                    activeSection={activeSection}
                    activeConversation={activeConversation}
                    onSelectConversation={setActiveConversation}
                    optimisticConversationUpdate={optimisticConversationUpdate}
                    syncedConversationUpdate={syncedConversationUpdate}
                    removedConversation={removedConversation}
                    onNavBadgesChange={setNavBadges}
                />
                <ChatWindow
                    conversation={activeConversation}
                    onConversationUpdated={handleConversationUpdated}
                    onConversationPreviewUpdate={handleConversationPreviewUpdate}
                    onConversationLeft={handleConversationLeft}
                />
            </div>
        </ConfigProvider>
    );
}
