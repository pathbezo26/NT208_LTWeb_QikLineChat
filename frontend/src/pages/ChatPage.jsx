import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import styles from './styles/ChatPage.module.css';

export default function ChatPage() {
    const [activeConversation, setActiveConversation] = useState(null);

    return (
        <div className={styles.layout}>
            <Sidebar
                activeConversation={activeConversation}
                onSelectConversation={setActiveConversation}
            />
            <ChatWindow conversation={activeConversation} />
        </div>
    );
}
