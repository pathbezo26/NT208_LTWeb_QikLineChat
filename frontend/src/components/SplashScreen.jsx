// frontend/src/components/SplashScreen.jsx
import styles from './styles/SplashScreen.module.css';

export default function SplashScreen() {
    return (
        <div className={styles.container}>
            {/* Phần trung tâm: Logo, tên app và spinner */}
            <div className={styles.mainContent}>
                <div className={styles.logoWrap}>
                    <img
                        className={styles.logo}
                        src="/qikline_logo.svg"
                        alt="QikLine"
                    />
                </div>

                <h2 className={styles.title}>QikLine</h2>
                <p className={styles.subtitle}>Kết nối nhanh, trò chuyện liền mạch</p>
                <div className={styles.spinner}></div>
            </div>

            {/* Phần đáy: Dòng bảo mật */}
            <div className={styles.footer}>
                <p>từ nhà phát triển của bạn</p>
                <span>
                    🔒 End-to-end encrypted
                </span>
            </div>
        </div>
    );
}
