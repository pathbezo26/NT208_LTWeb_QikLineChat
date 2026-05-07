import axiosInstance from './axiosInstance';

// Update User Avatar
export const updateAvatarAPI = async (formData) => {
    // formData will contain the 'avatar' file
    const response = await axiosInstance.put('/users/avatar', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data; // { message, user }
};