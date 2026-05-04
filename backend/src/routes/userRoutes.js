const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/users/search?q=keyword — search users by username (exclude self)
router.get('/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.json([]);

  try {
    const users = await User.find({
      username: { $regex: q.trim(), $options: 'i' },
      _id: { $ne: req.user.id },
    })
      .select('_id username email')
      .limit(20);

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server.', error: err.message });
  }
});

module.exports = router;
