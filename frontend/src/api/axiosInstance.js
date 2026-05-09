import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ─── Request interceptor: Tự động gắn JWT vào header trước mỗi request ────────
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── Response interceptor: Xử lý lỗi 401 toàn cục ───────────────────────────
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const reqUrl = error.config?.url || '';

        // Bỏ qua endpoint login để tránh vòng lặp (infinite loop)
        const isLoginEndpoint = reqUrl.includes('/auth/login') || reqUrl.endsWith('auth/login');

        if (status === 401 && !isLoginEndpoint) {
            // Token hết hạn hoặc không hợp lệ → xóa storage, redirect về login
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;