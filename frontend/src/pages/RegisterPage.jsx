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
        password: ''
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
            setError('Mật khẩu phải có ít nhất 6 ký tự.');
            return;
        }

        setIsLoading(true);

        try {
            // Gọi API: Đã tối ưu destructuring lấy thẳng user và token
            const { user, token } = await registerAPI(formData);

            // Đăng ký thành công thì tự động đăng nhập luôn và chuyển hướng
            login(user, token);
            navigate('/chat');
        } catch (err) {
            setError(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.pageBackground}>
            <div className={styles.container}>
                {/* Cột trái: Text */}
                <div className={styles.leftSide}>
                    <div className={styles.brandBadge}>Tạo kết nối mới thật dễ</div>
                    <h1 className={styles.logo}>QikLine</h1>
                    <h2 className={styles.tagline}>
                        Tham gia QikLine ngay hôm nay để kết nối với những người bạn mới.
                    </h2>
                    <p className={styles.sideText}>
                        Tạo tài khoản và bắt đầu cuộc trò chuyện của bạn trong vài giây.
                    </p>
                    <div className={styles.sideStatus}>
                        <span className={styles.statusDot}></span>
                        <span>Đăng ký nhanh chóng</span>
                    </div>
                </div>

                {/* Cột phải: Form */}
                <div className={styles.rightSide}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardEyebrow}>Bắt đầu</div>
                            <div className={styles.cardTitle}>Tạo tài khoản mới</div>
                            <p className={styles.cardSubtitle}>Chỉ cần vài thông tin cơ bản để tham gia QikLine.</p>
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
                                    placeholder="Tên người dùng"
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
                                    placeholder="Email của bạn"
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
                                    placeholder="Mật khẩu (Tối thiểu 6 ký tự)"
                                    required
                                />
                            </div>

                            <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
                                {isLoading ? 'Đang xử lý...' : 'Đăng ký'}
                            </button>
                        </form>

                        <hr className={styles.divider} />

                        <div className={styles.switchContainer}>
                            <Link to="/login" className={styles.btnSecondary}>
                                Đã có tài khoản? Đăng nhập
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
