import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import './styles/AuthPage.css';
import logoImg from '../assets/logo.png';

function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(form.email, form.password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Đăng nhập thất bại');
        } finally {
            setLoading(false);
        }
    };




    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <img
                        src={logoImg}
                        alt="QikLine Logo"
                        className="logo-image"
                    />
                    <h1 className="logo-text">QikLine</h1>
                </div>
                <h2 className="auth-title">Welcome back!</h2>
                <p className="auth-subtitle">Đăng nhập để tiếp tục trò chuyện</p>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <input
                            id="email" name="email" type="email"
                            placeholder="Email"
                            value={form.email} onChange={handleChange} required
                        />
                    </div>
                    <div className="form-group">
                        <input
                            id="password" name="password" type="password"
                            placeholder="Mật khẩu"
                            value={form.password} onChange={handleChange} required
                        />
                    </div>
                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? <span className="spinner" /> : 'Đăng nhập'}
                    </button>
                </form>

                <p className="auth-switch">
                    Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
                </p>
            </div>
        </div>
    );
}
export default LoginPage;