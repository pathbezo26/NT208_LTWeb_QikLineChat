import axiosInstance from './axiosInstance';

// Lấy danh sách tất cả conversation của user
export const getConversationsAPI = async () => {
    const response = await axiosInstance.get('/conversations');
    return response.data;
};

export const getConversationAPI = async (conversationId) => {
    const response = await axiosInstance.get(`/conversations/${conversationId}`);
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

export const updateGroupDetailsAPI = async (conversationId, data) => {
    const response = await axiosInstance.patch(`/conversations/${conversationId}/details`, data);
    return response.data; // { message, conversation }
};

export const addGroupMembersAPI = async (conversationId, memberIds) => {
    const response = await axiosInstance.put(`/conversations/${conversationId}/add`, {
        newMemberIds: memberIds,
    });

    return response.data; // { message, conversation }
};

export const transferGroupOwnerAPI = async (conversationId, memberId) => {
    const response = await axiosInstance.put(`/conversations/${conversationId}/owner`, {
        memberId,
    });

    return response.data; // { message, conversation }
};

export const updateGroupAdminsAPI = async (conversationId, adminIds, action) => {
    const response = await axiosInstance.put(`/conversations/${conversationId}/admins`, {
        adminIds,
        action,
    });

    return response.data; // { message, conversation }
};

export const leaveGroupAPI = async (conversationId, newOwnerId) => {
    const response = await axiosInstance.put(`/conversations/${conversationId}/leave`, {
        newOwnerId,
    });
    return response.data; // { message, conversationId }
};

export const removeGroupMemberAPI = async (conversationId, memberId) => {
    const response = await axiosInstance.put(`/conversations/${conversationId}/remove`, {
        memberId,
    });

    return response.data; // { message, conversation }
};

export const markConversationReadAPI = async (conversationId) => {
    const response = await axiosInstance.patch(`/conversations/${conversationId}/read`);
    return response.data; // { conversationId, unreadCount }
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
