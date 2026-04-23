import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import useAuth from './hooks/useAuth';
import ChatPage from './pages/ChatPage';

// Route bảo vệ — chưa đăng nhập thì redirect về /login
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Đang tải...</div>;
  return user ? children : <Navigate to="/login" />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
  </Routes>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
export default App;