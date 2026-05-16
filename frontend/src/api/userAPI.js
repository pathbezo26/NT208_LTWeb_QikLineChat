import axiosInstance from './axiosInstance';

// Upload avatar moi cho user hien tai.
// Backend dang cho field file ten la "avatar", nen FormData phai dung dung key nay.
export const uploadAvatarAPI = async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);

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
