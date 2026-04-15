import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import './AuthPage.css';

function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.password !== form.confirm) {
            return setError('Mật khẩu xác nhận không khớp');
        }
        setLoading(true);
        try {
            await register(form.username, form.email, form.password);
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.message || 'Đăng ký thất bại');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <span className="logo-icon">💬</span>
                    <h1 className="logo-text">QikLine</h1>
                </div>
                <h2 className="auth-title">Tạo tài khoản mới</h2>
                <p className="auth-subtitle">Miễn phí, nhanh chóng, bảo mật</p>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="username">Tên người dùng</label>
                        <input id="username" name="username" type="text"
                            placeholder="Nhập username" value={form.username}
                            onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input id="email" name="email" type="email"
                            placeholder="you@example.com" value={form.email}
                            onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Mật khẩu</label>
                        <input id="password" name="password" type="password"
                            placeholder="Tối thiểu 6 ký tự" value={form.password}
                            onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirm">Xác nhận mật khẩu</label>
                        <input id="confirm" name="confirm" type="password"
                            placeholder="Nhập lại mật khẩu" value={form.confirm}
                            onChange={handleChange} required />
                    </div>
                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? <span className="spinner" /> : 'Đăng ký'}
                    </button>
                </form>

                <p className="auth-switch">
                    Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                </p>
            </div>
        </div>
    );
}
export default RegisterPage;