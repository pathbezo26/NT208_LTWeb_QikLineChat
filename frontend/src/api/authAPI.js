import axiosInstance from './axiosInstance';

// Đăng ký tài khoản mới
export const registerAPI = async (username, email, password) => {
    const response = await axiosInstance.post('/auth/register', {
        username,
        email,
        password,
    });
    return response.data; // { message, token, user }
};

// Đăng nhập
export const loginAPI = async (email, password) => {
    const response = await axiosInstance.post('/auth/login', { email, password });
    return response.data; // { message, token, user }
};

// Lấy thông tin user hiện tại (dùng khi reload trang)
export const getMeAPI = async () => {
    const response = await axiosInstance.get('/auth/me');
    return response.data; // { user }
};