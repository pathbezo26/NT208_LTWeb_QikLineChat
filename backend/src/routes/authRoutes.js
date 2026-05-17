const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimiters');


const router = express.Router();
// POST /api/auth/register — Đăng ký tài khoản mới
router.post('/register', register);

// POST /api/auth/login — Đăng nhập, nhận JWT
router.post('/login', loginLimiter, login);

// GET /api/auth/me — Lấy thông tin user hiện tại (cần JWT)
router.get('/me', protect, getMe);

module.exports = router;
