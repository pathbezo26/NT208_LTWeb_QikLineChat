import { createContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import useAuth from '../hooks/useAuth';

export const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Nếu user chưa đăng nhập (không có token), không tạo kết nối
    if (!token) {
      if (socket) socket.disconnect();
      setSocket(null);
      return;
    }

    // Khởi tạo socket khi có token
    const newSocket = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('✅ Đã kết nối Socket:', newSocket.id);
    });

    newSocket.on('connect_error', (err) => {
      console.error('❌ Lỗi kết nối Socket:', err.message);
    });

    setSocket(newSocket);

    // Cleanup: Ngắt kết nối khi component unmount hoặc token thay đổi (đăng xuất)
    return () => {
      newSocket.disconnect();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // Chỉ chạy lại useEffect này nếu token thay đổi

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}