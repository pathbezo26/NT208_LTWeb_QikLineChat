import axiosInstance from './axiosInstance';

// Lấy danh sách tất cả conversation của user
export const getConversationsAPI = async () => {
    const response = await axiosInstance.get('/conversations');
    return response.data;
};

// Tạo conversation mới
// params: { type: 'private'|'group', name?: string, members: [userId, ...] }
export const createConversationAPI = async (data) => {
    const response = await axiosInstance.post('/conversations', data);
    return response.data;
};
