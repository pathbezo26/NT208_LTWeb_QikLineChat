import axiosInstance from './axiosInstance';

// Tìm kiếm người dùng theo username hoặc email
export const searchUsersAPI = (query) => 
  axiosInstance.get(`/users/search?q=${query}`);