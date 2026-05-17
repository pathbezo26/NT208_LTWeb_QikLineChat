const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
    getMessages,
    searchMessages,
    sendMessage,
    deleteMessage,
    uploadAttachments,
    MAX_ATTACHMENTS_PER_MESSAGE,
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const { sendMessageLimiter, uploadLimiter } = require('../middleware/rateLimiters');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: MAX_ATTACHMENTS_PER_MESSAGE,
    },
});

const handleAttachmentUpload = (req, res, next) => {
    upload.array('attachments', MAX_ATTACHMENTS_PER_MESSAGE)(req, res, (err) => {
        if (!err) return next();

        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'Each attachment must not exceed 10MB' });
            }

            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ message: `You can upload up to ${MAX_ATTACHMENTS_PER_MESSAGE} files` });
            }
        }

        return res.status(400).json({ message: err.message || 'Invalid attachment file' });
    });
};

router.get('/:conversationId/search', protect, searchMessages);
router.get('/:conversationId', protect, getMessages);
router.post('/:conversationId/attachments', protect, uploadLimiter, handleAttachmentUpload, uploadAttachments);
router.post('/', protect, sendMessageLimiter, sendMessage);
router.delete('/:messageId', protect, deleteMessage);

module.exports = router;
