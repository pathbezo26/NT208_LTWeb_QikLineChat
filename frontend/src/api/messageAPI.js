import axiosInstance from './axiosInstance';

// Lấy lịch sử tin nhắn của một conversation
export const getMessagesAPI = async (conversationId, params = {}) => {
    const response = await axiosInstance.get(`/messages/${conversationId}`, { params });
    return response.data;
};

// Gửi tin nhắn mới (lưu vào DB qua REST — song song với socket)
export const sendMessageAPI = async (data) => {
    const response = await axiosInstance.post('/messages', data);
    return response.data;
};

export const searchMessagesAPI = async (conversationId, keyword, params = {}) => {
    const response = await axiosInstance.get(`/messages/${conversationId}/search`, {
        params: { q: keyword, ...params },
    });
    return response.data;
};

export const deleteMessageAPI = async (messageId, scope = 'me') => {
    const response = await axiosInstance.delete(`/messages/${messageId}`, {
        data: { scope },
    });
    return response.data;
};

export const togglePinMessageAPI = async (messageId) => {
    const response = await axiosInstance.patch(`/messages/${messageId}/pin`);
    return response.data;
};

export const getPinnedMessagesAPI = async (conversationId) => {
    const response = await axiosInstance.get(`/messages/${conversationId}/pinned`);
    return response.data;
};

export const getSharedResourcesAPI = async (conversationId) => {
    const response = await axiosInstance.get(`/messages/${conversationId}/shared-resources`);
    return response.data;
};

export const uploadMessageAttachmentsAPI = async (conversationId, files) => {
    const formData = new FormData();

    files.forEach((file) => {
        formData.append('attachments', file);
    });

    const baseURL = import.meta.env.VITE_API_URL || '';
    const token = localStorage.getItem('token');
    const response = await fetch(`${baseURL}/messages/${conversationId}/attachments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || 'Could not upload attachment.');
    }

    return data;
};
