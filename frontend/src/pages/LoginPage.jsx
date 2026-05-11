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
            setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.pageBackground}>
            <div className={styles.container}>
                {/* Cột trái: Text */}
                <div className={styles.leftSide}>
                    <div className={styles.brandBadge}>Trò chuyện nhanh hơn mỗi ngày</div>
                    <h1 className={styles.logo}>QikLine</h1>
                    <h2 className={styles.tagline}>
                        Khám phá những điều bạn yêu thích và kết nối với mọi người.
                    </h2>
                    <p className={styles.sideText}>
                        Một không gian trò chuyện đơn giản, nhanh và dễ bắt đầu.
                    </p>
                    <div className={styles.sideStatus}>
                        <span className={styles.statusDot}></span>
                        <span>Sẵn sàng kết nối</span>
                    </div>
                </div>

                {/* Cột phải: Form */}
                <div className={styles.rightSide}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardEyebrow}>Xin chào</div>
                            <div className={styles.cardTitle}>Đăng nhập vào QikLine</div>
                            <p className={styles.cardSubtitle}>Nhập thông tin của bạn để tiếp tục trò chuyện.</p>
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
                                    placeholder="Email hoặc số điện thoại"
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
                                    placeholder="Mật khẩu"
                                    required
                                />
                            </div>

                            <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
                                {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
                            </button>
                        </form>

                        <hr className={styles.divider} />

                        <div className={styles.switchContainer}>
                            <Link to="/register" className={styles.btnSecondary}>
                                Tạo tài khoản mới
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
