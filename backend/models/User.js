const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, 'Username là bắt buộc'],
            unique: true,
            trim: true,
            minlength: [3, 'Username phải có ít nhất 3 ký tự'],
            maxlength: [30, 'Username tối đa 30 ký tự'],
        },
        email: {
            type: String,
            required: [true, 'Email là bắt buộc'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'],
        },
        passwordHash: {
            type: String,
            required: [true, 'Password là bắt buộc'],
        },
    },
    { timestamps: true }
);

// Index tăng tốc truy vấn (đã khai báo unique ở trên nên Mongoose tự tạo index)
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });

// Method: so sánh password nhập vào với hash trong DB
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.passwordHash);
};

module.exports = mongoose.model('User', UserSchema);