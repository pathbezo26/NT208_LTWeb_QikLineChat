import { useEffect, useRef, useState } from 'react';
import {
    ContactsOutlined,
    LogoutOutlined,
    MessageOutlined,
    SettingOutlined,
    TeamOutlined,
} from '@ant-design/icons';
import useAuth from '../hooks/useAuth';
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
    const { logout } = useAuth();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const settingsRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!settingsRef.current?.contains(event.target)) {
                setIsSettingsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSettingsClick = () => {
        onSectionChange('settings');
        setIsSettingsOpen((current) => !current);
    };

    const handleLogout = () => {
        setIsSettingsOpen(false);
        logout();
    };

    return (
        <nav className={styles.rail} aria-label="Điều hướng chính">
            <div className={styles.brand} title="QikLineChat">
                <img src="/qikline_logo.png" alt="" className={styles.logo} />
            </div>

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

            <div className={styles.bottomNav} ref={settingsRef}>
                <button
                    type="button"
                    className={`${styles.navButton} ${activeSection === 'settings' ? styles.active : ''}`}
                    onClick={handleSettingsClick}
                    title="Cài đặt"
                    aria-label="Cài đặt"
                    aria-expanded={isSettingsOpen}
                    aria-haspopup="menu"
                    aria-pressed={activeSection === 'settings'}
                >
                    <span className={styles.icon}>
                        <SettingOutlined />
                    </span>
                </button>

                {isSettingsOpen && (
                    <div className={styles.settingsMenu} role="menu">
                        <button
                            type="button"
                            className={styles.menuItem}
                            onClick={handleLogout}
                            role="menuitem"
                        >
                            <LogoutOutlined className={styles.menuIcon} />
                            <span>Đăng xuất</span>
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
}
