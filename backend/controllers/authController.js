const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Hàm tạo JWT token ────────────────────────────────────────────────────────
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────
const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 1. Validate đầu vào
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        // 2. Kiểm tra email hoặc username đã tồn tại chưa
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            if (existingUser.email === email.toLowerCase()) {
                return res.status(409).json({ message: 'Email đã được sử dụng' });
            }
            return res.status(409).json({ message: 'Username đã được sử dụng' });
        }

        // 3. Hash password (salt rounds = 12)
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        // 4. Tạo user mới
        const user = await User.create({ username, email, passwordHash });

        // 5. Tạo JWT và trả về
        const token = generateToken(user._id);

        res.status(201).json({
            message: 'Đăng ký thành công',
            token,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Lỗi server, vui lòng thử lại' });
    }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validate đầu vào
        if (!email || !password) {
            return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
        }

        // 2. Tìm user theo email
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
        }

        // 3. So sánh password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
        }

        // 4. Tạo JWT và trả về
        const token = generateToken(user._id);

        res.status(200).json({
            message: 'Đăng nhập thành công',
            token,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Lỗi server, vui lòng thử lại' });
    }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Route được bảo vệ — dùng để frontend lấy lại thông tin user khi reload trang
const getMe = async (req, res) => {
    try {
        res.status(200).json({
            user: {
                _id: req.user._id,
                username: req.user.username,
                email: req.user.email,
                createdAt: req.user.createdAt,
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

const searchUsers = async (req, res) => {
    try {
        const keyword = req.query.username;

        // 1. Must provide a search keyword
        if (!keyword) {
            return res.status(400).json({ message: 'Vui lòng nhập username để tìm kiếm' });
        }

        // 2. Search MongoDB for matching usernames
        // $regex makes it a partial match, $options: 'i' makes it case-insensitive
        // $ne: req.user._id means "don't return yourself in results"
        const users = await User.find({
            username: { $regex: keyword, $options: 'i' },
            _id: { $ne: req.user._id }
        }).select('_id username email');

        res.status(200).json({ users });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

module.exports = { register, login, getMe, searchUsers };