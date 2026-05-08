
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext'; // Nhớ import AuthProvider
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import useAuth from './hooks/useAuth';
import { SocketProvider } from './context/SocketContext';

// 1. Chỉ cho phép người ĐÃ đăng nhập (nếu chưa -> đuổi về Login)
function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

// 2. Chỉ cho phép người CHƯA đăng nhập (nếu đã login -> đẩy thẳng vào Chat)
function PublicRoute({ children }) {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/chat" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider sẽ kiểm tra token, hiển thị SplashScreen rồi mới render Routes bên trong */}
      <AuthProvider>
        <Routes>
          {/* Điều hướng trang chủ mặc định */}
          <Route path="/" element={<Navigate to="/chat" replace />} />

          <Route
            path="/login"
            element={<PublicRoute><LoginPage /></PublicRoute>}
          />

          <Route
            path="/register"
            element={<PublicRoute><RegisterPage /></PublicRoute>}
          />

          <Route
            path="/chat"
            element={<PrivateRoute><SocketProvider><ChatPage /></SocketProvider></PrivateRoute>}
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}