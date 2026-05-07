const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
//8.8.8.8 : google public dns.
//1.1.1.1 : cloudfare public dns.

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ Đã kết nối DB: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Lỗi kết nối MongoDB: ${error.message}`);
        mongoose.set('debug', true); // Xem chi tiết các query
        process.exit(1);
    }
};

//make connectDB available through other files via node.js
module.exports = connectDB;