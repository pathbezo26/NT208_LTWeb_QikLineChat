const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { register, login, getMe, searchUsers } = require('../controllers/authController');

const router = express.Router();
// POST /api/auth/register — Đăng ký tài khoản mới
router.post('/register', register);

// POST /api/auth/login — Đăng nhập, nhận JWT
router.post('/login', login);

// GET /api/auth/me — Lấy thông tin user hiện tại (cần JWT)
router.get('/me', protect, getMe);

// GET /api/auth/search — Tìm kiếm user theo username (cần JWT)
router.get('/search', protect, searchUsers);

module.exports = router;
