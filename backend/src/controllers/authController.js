const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Hàm tạo JWT token ────────────────────────────────────────────────────────
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, username: user.username, userId: user.userId || '' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

const formatAuthUser = (user) => ({
    _id: user._id,
    username: user.username,
    userId: user.userId || '',
    email: user.email,
    avatar: {
        url: user.avatar?.url || null,
        originalUrl: user.avatar?.originalUrl || null,
        publicId: user.avatar?.publicId || null,
        crop: user.avatar?.crop || null,
        updatedAt: user.avatar?.updatedAt || null,
    },
    lastSeenAt: user.lastSeenAt,
    blockedUsers: user.blockedUsers || [],
    contacts: user.contacts || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const userId = req.body.userId?.trim().toLowerCase();

        // 1. Validate đầu vào
        if (!username || !userId || !email || !password) {
            return res.status(400).json({ message: 'Please fill in all fields' });
        }
        if (!/^[a-z0-9._]{3,30}$/.test(userId)) {
            return res.status(400).json({ message: 'User ID must be 3 to 30 characters and can only contain letters, numbers, dots, and underscores' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // 2. Kiểm tra email hoặc username đã tồn tại chưa
        const existingUser = await User.findOne({ $or: [{ email }, { username }, { userId }] });
        if (existingUser) {
            if (existingUser.email === email.toLowerCase()) {
                return res.status(409).json({ message: 'Email is already in use' });
            }
            if (existingUser.userId === userId) {
                return res.status(409).json({ message: 'User ID is already taken' });
            }
            return res.status(409).json({ message: 'Username is already taken' });
        }

        // 3. Hash password (salt rounds = 12)
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        // 4. Tạo user mới
        const user = await User.create({ username, userId, email, passwordHash });

        // 5. Tạo JWT và trả về
        const token = generateToken(user);

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: formatAuthUser(user),
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error, please try again' });
    }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validate đầu vào
        if (!email || !password) {
            return res.status(400).json({ message: 'Please enter email and password' });
        }

        // 2. Tìm user theo email
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // 3. So sánh password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // 4. Tạo JWT và trả về
        const token = generateToken(user);

        res.status(200).json({
            message: 'Login successful',
            token,
            user: formatAuthUser(user),
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error, please try again' });
    }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Route được bảo vệ — dùng để frontend lấy lại thông tin user khi reload trang
const getMe = async (req, res) => {
    try {
        res.status(200).json({
            user: formatAuthUser(req.user),
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error.', error: err.message });
    }
};

module.exports = { register, login, getMe };
