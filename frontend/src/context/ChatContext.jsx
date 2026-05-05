import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// Khởi tạo Context
const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Lưu thông tin user hiện tại (lấy từ JWT/localStorage)
  const [selectedChat, setSelectedChat] = useState(); // Cuộc trò chuyện đang được chọn để hiển thị ở ChatBox
  const [chats, setChats] = useState([]); // Danh sách các cuộc trò chuyện ở Sidebar
  const [socket, setSocket] = useState(null); // Lưu instance của socket
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Lấy user từ localStorage khi app khởi chạy
  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    setUser(userInfo);
  }, []);

  // Khởi tạo Socket khi đã có thông tin user
  useEffect(() => {
    if (user && user.token) {
      // Thay thế URL bằng địa chỉ server của bạn
      const newSocket = io('http://localhost:5000', {
        auth: {
          token: user.token, // Gửi token để backend xác thực (Tính năng: Xác thực Socket)
        },
      });

      setSocket(newSocket);

      newSocket.on('connect', () => {
        setIsSocketConnected(true);
        // Báo cho server biết user này đã online
        newSocket.emit('setup', user);
      });

      // Cleanup function khi component unmount
      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  return (
    <ChatContext.Provider
      value={{
        user, setUser,
        selectedChat, setSelectedChat,
        chats, setChats,
        socket, isSocketConnected
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook để gọi Context nhanh hơn
export const ChatState = () => {
  return useContext(ChatContext);
};