const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    // Kiểm tra header Authorization có dạng "Bearer <token>"
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Tách lấy token (bỏ chữ "Bearer ")
            token = req.headers.authorization.split(' ')[1];

            // Giải mã token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Gắn thông tin user vào req (bỏ passwordHash)
            req.user = await User.findById(decoded.id).select('-passwordHash');

            if (!req.user) {
                return res.status(401).json({ message: 'User không tồn tại' });
            }

            next();
        } catch (error) {
            return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
        }
    }
    else {
        return res.status(401).json({ message: 'Không có token, truy cập bị từ chối' });
    }
};

module.exports = { protect };