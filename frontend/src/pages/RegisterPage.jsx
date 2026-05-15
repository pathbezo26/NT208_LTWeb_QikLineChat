import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerAPI } from '../api/authAPI';
import useAuth from '../hooks/useAuth';
import styles from './styles/AuthPage.module.css';

export default function RegisterPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    // Đổi tên state cho rõ nghĩa
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Tách name và value ra để dễ đọc, tránh viết gộp khó nhìn
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Xử lý validate ngay từ đầu
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters!');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match!');
            return;
        }

        setIsLoading(true);

        try {
            // Gọi API: Đã tối ưu destructuring lấy thẳng user và token
            const registerData = {
                username: formData.username,
                email: formData.email,
                password: formData.password
            };
            const { user, token } = await registerAPI(registerData);

            // Đăng ký thành công thì tự động đăng nhập luôn và chuyển hướng
            login(user, token);
            navigate('/chat');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.pageBackground}>
            <div className={styles.container}>
                {/* Cột trái: Text */}
                <div className={styles.leftSide}>
                    <div className={styles.brandBadge}>Make new connections easily</div>
                    <h1 className={styles.logo}>QikLine</h1>
                    <h2 className={styles.tagline}>
                        Join QikLine today to connect with new people.
                    </h2>
                    <p className={styles.sideText}>
                        Create an account and start your conversation in seconds.
                    </p>
                    <div className={styles.sideStatus}>
                        <span className={styles.statusDot}></span>
                        <span>Quick sign-up</span>
                    </div>
                </div>

                {/* Cột phải: Form */}
                <div className={styles.rightSide}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardEyebrow}>Get started</div>
                            <div className={styles.cardTitle}>Create a new account</div>
                            <p className={styles.cardSubtitle}>Just a few details to join QikLine.</p>
                        </div>

                        {error && <div className={styles.error}>{error}</div>}

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.field}>
                                <input
                                    id="username"
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    placeholder="Username"
                                    required
                                />
                            </div>

                            <div className={styles.field}>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Email"
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

                            <div className={styles.field}>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Confirm password"
                                    required
                                />
                            </div>

                            <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
                                {isLoading ? 'Processing...' : 'Sign up'}
                            </button>
                        </form>

                        <hr className={styles.divider} />

                        <div className={styles.switchContainer}>
                            <Link to="/login" className={styles.btnSecondary}>
                                Already have an account? Sign in
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
