// frontend/src/components/SplashScreen.jsx
import styles from './styles/SplashScreen.module.css';

export default function SplashScreen() {
    return (
        <div className={styles.container}>

            {/* 1. Phần trung tâm: Logo và Spinner xoay xoay */}
            <div className={styles.mainContent}>
                <div className={styles.icon}>💬</div>
                <h2 className={styles.title}>QikLine</h2>
                <div className={styles.spinner}></div>
            </div>

            {/* 2. Phần đáy: Dòng chữ bản quyền/bảo mật */}
            <div className={styles.footer}>
                <p>từ nhà phát triển của bạn</p>
                <span>
                    🔒 End-to-end encrypted
                </span>
            </div>

        </div>
    );
}