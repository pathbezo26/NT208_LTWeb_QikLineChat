import axiosInstance from './axiosInstance';

// Upload avatar moi cho user hien tai.
// Backend dang cho field file ten la "avatar", nen FormData phai dung dung key nay.
const appendAvatarCrop = (formData, crop) => {
    if (!crop) return;

    formData.append('cropX', String(crop.x));
    formData.append('cropY', String(crop.y));
    formData.append('cropSize', String(crop.size));
};

export const uploadAvatarAPI = async (file, crop) => {
    const formData = new FormData();
    formData.append('avatar', file);
    appendAvatarCrop(formData, crop);

    const response = await axiosInstance.patch('/users/me/avatar', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data; // { message, user }
};

// Xoa avatar hien tai va de UI quay ve chu cai dau cua username.
export const deleteAvatarAPI = async () => {
    const response = await axiosInstance.delete('/users/me/avatar');
    return response.data; // { message, user }
};

// Doi username cua user hien tai.
export const updateUsernameAPI = async (username) => {
    const response = await axiosInstance.patch('/users/me/username', { username });
    return response.data; // { message, user }
};

export const updateAvatarCropAPI = async (crop) => {
    const response = await axiosInstance.patch('/users/me/avatar/crop', {
        cropX: crop.x,
        cropY: crop.y,
        cropSize: crop.size,
    });

    return response.data; // { message, user }
};

export const updateUserIdAPI = async (userId) => {
    const response = await axiosInstance.patch('/users/me/user-id', { userId });
    return response.data; // { message, user }
};

export const blockUserAPI = async (userId) => {
    const response = await axiosInstance.post(`/users/${userId}/block`);
    return response.data;
};

export const unblockUserAPI = async (userId) => {
    const response = await axiosInstance.delete(`/users/${userId}/block`);
    return response.data;
};

export const reportUserAPI = async (userId, data) => {
    const response = await axiosInstance.post(`/users/${userId}/report`, data);
    return response.data;
};

export const getContactsAPI = async () => {
    const response = await axiosInstance.get('/users/contacts');
    return response.data;
};

export const sendContactRequestAPI = async (userId) => {
    const response = await axiosInstance.post(`/users/${userId}/contact-request`);
    return response.data;
};

export const acceptContactRequestAPI = async (requestId) => {
    const response = await axiosInstance.post(`/users/contact-requests/${requestId}/accept`);
    return response.data;
};

export const declineContactRequestAPI = async (requestId) => {
    const response = await axiosInstance.post(`/users/contact-requests/${requestId}/decline`);
    return response.data;
};

export const cancelContactRequestAPI = async (requestId) => {
    const response = await axiosInstance.delete(`/users/contact-requests/${requestId}`);
    return response.data;
};

export const removeContactAPI = async (userId) => {
    const response = await axiosInstance.delete(`/users/${userId}/contact`);
    return response.data;
};
