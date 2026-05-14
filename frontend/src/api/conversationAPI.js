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

export const uploadGroupAvatarAPI = async (conversationId, file) => {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await axiosInstance.patch(`/conversations/${conversationId}/avatar`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data; // { message, conversation }
};

//Tìm kiếm users
export const searchUsersAPI = async (keyword) => {
    // Sửa lại đường dẫn /users/search cho đúng với API bên Backend của bạn
    const response = await axiosInstance.get(`/conversations?q=${keyword}`);
    return response.data;
};

//Xóa conversation
export const deleteConversationAPI = async (conversationId) => {
    const response = await axiosInstance.delete(`/conversations/${conversationId}`);
    return response.data;
};
