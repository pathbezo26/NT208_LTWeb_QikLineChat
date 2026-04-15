import { createContext, useState, useEffect } from 'react';
import { loginAPI, registerAPI, getMeAPI } from '../api/authAPI';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [loading, setLoading] = useState(true);

    // Khi app khởi động, nếu có token cũ → lấy lại thông tin user
    useEffect(() => {
        const initAuth = async () => {
            if (token) {
                try {
                    const data = await getMeAPI();
                    setUser(data.user);
                } catch {
                    logout(); // Token hết hạn
                }
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = async (email, password) => {
        const data = await loginAPI(email, password);
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const register = async (username, email, password) => {
        const data = await registerAPI(username, email, password);
        //localStorage.setItem('token', data.token);
        //setToken(data.token);
        //setUser(data.user);
        return data.message;
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};