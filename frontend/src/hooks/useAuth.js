import { useContext } from 'react';
import { AuthContext } from '../context/AuthContextValue';

const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth phải dùng trong AuthProvider');
    return context;
};

export default useAuth;
