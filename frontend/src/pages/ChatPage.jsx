import { useState } from 'react';
import AppNavRail from '../components/AppNavRail';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import styles from './styles/ChatPage.module.css';

export default function ChatPage() {
    const [activeSection, setActiveSection] = useState('messages');
    const [activeConversation, setActiveConversation] = useState(null);

    return (
        <div className={styles.layout}>
            <AppNavRail
                activeSection={activeSection}
                onSectionChange={setActiveSection}
            />
            <Sidebar
                activeSection={activeSection}
                activeConversation={activeConversation}
                onSelectConversation={setActiveConversation}
            />
            <ChatWindow conversation={activeConversation} />
        </div>
    );
}
