import axiosInstance from './axiosInstance';

//conversationapi

// Create a new conversation or return existing one
export const createConversationAPI = async (targetUserId) => {
    const response = await axiosInstance.post('/conversations', {
        targetUserId,
        type: 'private'
    });
    return response.data;
};

// Get all conversations for logged in user
export const getConversationsAPI = async () => {
    const response = await axiosInstance.get('/conversations');
    return response.data;
};

//message api

// Send a message to a conversation
export const sendMessageAPI = async (conversationId, content) => {
    const response = await axiosInstance.post('/messages', {
        conversationId,
        content
    });
    return response.data;
};

// Get all messages in a conversation
export const getMessagesAPI = async (conversationId) => {
    const response = await axiosInstance.get(`/messages/${conversationId}`);
    return response.data;
};

//user search api

// Search for users by username
export const searchUsersAPI = async (username) => {
    const response = await axiosInstance.get(`/auth/search?username=${username}`);
    return response.data;
};