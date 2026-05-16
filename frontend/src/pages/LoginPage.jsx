import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import styles from './styles/AuthPage.module.css';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Tách biến name, value ra cho dễ nhìn thay vì viết gộp
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // Đẩy toàn bộ trách nhiệm gọi API và lưu state cho Context
            await login(formData);

            // Thành công thì chuyển trang
            navigate('/chat');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.pageBackground}>
            <div className={styles.container}>
                {/* Cột trái: Text */}
                <div className={styles.leftSide}>
                    <div className={styles.brandBadge}>Chat faster every day</div>
                    <h1 className={styles.logo}>QikLine</h1>
                    <h2 className={styles.tagline}>
                        Discover what you love and connect with everyone.
                    </h2>
                    <p className={styles.sideText}>
                        A simple, fast chat space that is easy to get started with.
                    </p>
                    <div className={styles.sideStatus}>
                        <span className={styles.statusDot}></span>
                        <span>Ready to connect</span>
                    </div>
                </div>

                {/* Cột phải: Form */}
                <div className={styles.rightSide}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardEyebrow}>Hello</div>
                            <div className={styles.cardTitle}>Sign in to QikLine</div>
                            <p className={styles.cardSubtitle}>Enter your details to continue chatting.</p>
                        </div>

                        {error && <div className={styles.error}>{error}</div>}

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.field}>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Email or phone number"
                                    required
                                />
                            </div>

                            <div className={styles.field}>
                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Password"
                                    required
                                />
                            </div>

                            <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
                                {isLoading ? 'Processing...' : 'Sign in'}
                            </button>
                        </form>

                        <hr className={styles.divider} />

                        <div className={styles.switchContainer}>
                            <Link to="/register" className={styles.btnSecondary}>
                                Create a new account
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
