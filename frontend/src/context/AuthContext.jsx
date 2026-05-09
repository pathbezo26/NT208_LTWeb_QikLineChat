import { createContext, useState, useEffect } from 'react';
import { getMeAPI } from '../api/authAPI';
import SplashScreen from '../components/SplashScreen';
import { loginAPI } from '../api/authAPI';
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [isLoading, setIsLoading] = useState(true);

    // Chạy 1 lần khi ứng dụng vừa tải (F5)
    useEffect(() => {
        const verifyUser = async () => {
            // Nếu không có token trong localStorage thì kết thúc luôn
            if (!token) {
                setIsLoading(false);
                return;
            }

            // Nếu có token, gọi API lên server để lấy thông tin user mới nhất
            try {
                const data = await getMeAPI();
                setUser(data.user);
            } catch (error) {
                console.error('Token hết hạn hoặc không hợp lệ');
                logout(); // Xóa thông tin cũ đi
            } finally {
                setIsLoading(false); // Render UI
            }
        };

        verifyUser();
    }, [token]);

    const login = async (dataLog) => {
        const data = await loginAPI(dataLog);
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setToken(data.token);

        return data;
    };
    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
    };

    // Tránh việc chớp màn hình UI khi đang gọi API verify token
    if (isLoading) {
        return <SplashScreen />; // Bạn có thể thay bằng component Spinner
    }

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}