import axiosInstance from './axiosInstance';

// Lấy lịch sử tin nhắn của một conversation
export const getMessagesAPI = async (conversationId) => {
    const response = await axiosInstance.get(`/messages/${conversationId}`);
    return response.data;
};

// Gửi tin nhắn mới (lưu vào DB qua REST — song song với socket)
export const sendMessageAPI = async (data) => {
    const response = await axiosInstance.post('/messages', data);
    return response.data;
};