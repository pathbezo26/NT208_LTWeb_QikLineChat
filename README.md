# 💬 WebChat App — Ứng Dụng Chat Thời Gian Thực

[![React][React.js]][React-url]
[![Node][Node.js]][Node-url]
[![MongoDB][MongoDB.js]][MongoDB-url]
[![Socket.IO][SocketIO.js]][SocketIO-url]
[![Express][Express.js]][Express-url]
[![Vite][Vite.js]][Vite-url]
[![JWT][JWT.js]][JWT-url]

---

## 👥 Thành Viên Nhóm

| STT | Họ và tên | MSSV  | GitHub |
|-----|-----------|------|--------|
| 1 | Nguyễn Tấn Phát | 24521306 | [@pathbezo26](https://github.com/pathbezo26) |
| 2 | Lê Hồ Thành Phát | 24521297 | [@LEHOTHANHPHAT](https://github.com/LEHOTHANHPHAT) |
| 3 | Nguyễn Nhật Quang | 24521472 | [@maccriagor](https://github.com/maccriagor) |
| 4 | Lê Nam Khánh | 24520783 | [@nhat3911](https://github.com/nhat3911) |

---

## 📖 Mô Tả Tổng Quan

**QikLine Chat** là một ứng dụng nhắn tin thời gian thực, cho phép người dùng trò chuyện trực tiếp theo hình thức **chat 1-1 (private)** và **chat nhóm (group)**. Ứng dụng được xây dựng theo kiến trúc client-server hiện đại, kết hợp **REST API** để xử lý dữ liệu bền vững và **Socket.IO** để truyền tin nhắn tức thời không cần reload trang.

Dự án hướng tới trải nghiệm người dùng mượt mà: đăng nhập bảo mật bằng JWT, tự động tải lịch sử trò chuyện, hiển thị tin nhắn realtime và quản lý các cuộc trò chuyện linh hoạt. Toàn bộ dữ liệu được lưu trữ trên MongoDB, đảm bảo tính bền vững và khả năng mở rộng cho hệ thống.

---

## ✨ Tính Năng Nổi Bật

- ✅ **Đăng ký / Đăng nhập** bảo mật với xác thực JWT
- ✅ **Chat 1-1 (Private Chat)** — nhắn tin riêng tư giữa hai người dùng
- ✅ **Chat nhóm (Group Chat)** — tạo nhóm, thêm nhiều thành viên và chat cùng nhau
- ✅ **Gửi & nhận tin nhắn thời gian thực** via Socket.IO (không cần F5 trang)
- ✅ **Lưu lịch sử tin nhắn** vào MongoDB, tự động tải lại khi mở cuộc trò chuyện
- ✅ **Danh sách cuộc trò chuyện** hiển thị trên Sidebar (cả private lẫn group)
- ✅ **Tìm kiếm người dùng** để bắt đầu cuộc trò chuyện mới
- ✅ **Tạo nhóm chat** với tên nhóm và danh sách thành viên tùy chọn
- ✅ **Xác thực Socket** — token JWT được kiểm tra khi kết nối socket

---

## 🛠️ Công Nghệ Sử Dụng

### 🖥️ Frontend
| Công nghệ | Mục đích |
|-----------|---------|
| ⚛️ **ReactJS 18** | Xây dựng giao diện người dùng dạng SPA |
| ⚡ **Vite** | Build tool nhanh, thay thế CRA |
| 🔀 **React Router DOM** | Điều hướng giữa các trang (Login, Chat...) |
| 🌐 **Axios** | Gọi REST API với interceptor tự gắn JWT |
| 🔌 **Socket.IO Client** | Kết nối WebSocket với backend |
| 🗂️ **Context API** | Quản lý state toàn cục (Auth, Socket) |

### 🔧 Backend
| Công nghệ | Mục đích |
|-----------|---------|
| 🟢 **Node.js** | Runtime JavaScript phía server |
| 🚂 **Express.js** | Framework xây dựng REST API |
| 🔌 **Socket.IO** | Xử lý kết nối WebSocket realtime |
| 🍃 **MongoDB** | Cơ sở dữ liệu NoSQL lưu trữ dữ liệu |
| 🦴 **Mongoose** | ODM — định nghĩa schema và thao tác với MongoDB |
| 🔐 **JWT (jsonwebtoken)** | Tạo và xác thực token xác thực |
| 🔒 **bcryptjs** | Mã hóa mật khẩu người dùng |

---

## 📁 Cấu Trúc Thư Mục

```
qikline_chat/
├── frontend/                             ← ReactJS + Vite
│   ├── public/                          
│   ├── src/
│   │   ├── assets/                       ← Ảnh, icon, avatar mặc định, logo
│   │   │
│   │   ├── components/
│   │   │   ├── Sidebar.jsx               ← Hiển thị danh sách đoạn chat private + group
│   │   │   ├── ChatWindow.jsx            ← Khung chat hiện tại, hiển thị nội dung đang chat
│   │   │   ├── MessageList.jsx           ← Render danh sách tin nhắn theo conversation
│   │   │   ├── ChatInput.jsx             ← Ô nhập tin nhắn, nút gửi, emit socket send message
│   │   │   ├── UserSearch.jsx            ← Tìm user để bắt đầu private chat mới
│   │   │   └── CreateGroupModal.jsx      ← Popup tạo nhóm chat cơ bản
│   │   │
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx             ← Form đăng nhập, gọi POST /api/auth/login
│   │   │   ├── RegisterPage.jsx          ← Form đăng ký, gọi POST /api/auth/register
│   │   │   └── ChatPage.jsx              ← Trang chat, load tin nhắn     
│   │   │
│   │   ├── context/
│   │   │   ├── AuthContext.jsx           ← Lưu user đăng nhập, token, hàm login/logout cho toàn app
│   │   │   └── SocketContext.jsx         ← Tạo 1 socket dùng chung cho toàn bộ app
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js                ← Hook lấy nhanh dữ liệu từ AuthContext
│   │   │   └── useSocket.js              ← Hook lấy nhanh socket từ SocketContext
│   │   │
│   │   ├── api/
│   │   │   ├── axiosInstance.js          ← Tạo axios baseURL backend + gắn token header nếu có JWT
│   │   │   ├── authAPI.js                ← Chứa các hàm gọi /api/auth/*
│   │   │   ├── messageAPI.js             ← Chứa các hàm gọi /api/messages/*
│   │   │   └── conversationAPI.js        ← Chứa các hàm gọi /api/conversations/*
│   │   │
│   │   ├── utils/
│   │   │   └── formatTime.js             ← Format giờ/phút/ngày hiển thị cho tin nhắn
│   │   │
│   │   ├── App.jsx                       ← Định nghĩa routes chính của app
│   │   └── main.jsx                      ← Entry point, bọc App bằng AuthProvider + SocketProvider
│   │
│   ├── package.json                      ← Danh sách thư viện frontend
│   └── vite.config.js                    ← Cấu hình Vite
│
└── backend/                              ← NodeJS + Express + Socket.IO
    ├── src/
    │   ├── config/
    │   │   └── db.js                     ← Kết nối MongoDB bằng mongoose.connect()
    │   │
    │   ├── controllers/
    │   │   ├── authController.js         ← Xử lý đăng ký, đăng nhập, tạo JWT
    │   │   ├── messageController.js      ← Xử lý GET lịch sử tin nhắn, lưu message vào DB
    │   │   └── conversationController.js ← Tạo mới và lấy danh sách private/group conversation
    │   │
    │   ├── models/
    │   │   ├── User.js                   ← Schema user: username, email, passwordHash
    │   │   ├── Message.js                ← Schema message: sender, content, conversationId, createdAt
    │   │   └── Conversation.js           ← Schema conversation: members[], type(private/group), name
    │   │
    │   ├── routes/
    │   │   ├── authRoutes.js             ← POST /register, POST /login
    │   │   ├── messageRoutes.js          ← GET /messages/:conversationId, POST /messages
    │   │   └── conversationRoutes.js     ← GET /conversations, POST /conversations
    │   │
    │   ├── middleware/
    │   │   └── authMiddleware.js         ← Verify JWT trước các route cần bảo vệ
    │   │
    │   ├── socket/
    │   │   └── socketHandler.js          ← Toàn bộ xử lý Socket.IO: join room, send message, online users
    │   │
    │   └── server.js                     ← Entry point backend: Express app + HTTP server + Socket.IO init
    │
    ├── .env                              ← PORT, MONGO_URI, JWT_SECRET
    └── package.json                      ← Danh sách thư viện backend
```

---

## 🔄 Sơ Đồ Luồng Hoạt Động

### Luồng 1 — Khởi Động App & Đăng Nhập

![Luồng đăng nhập](./docs/flow_1_login.svg)

---

### Luồng 2 — Tải Lịch Sử Chat (REST API)

![Luồng tải chat history](./docs/flow_2_load_history.svg)

---

### Luồng 3 — Gửi & Nhận Tin Nhắn Realtime (Socket.IO)

![Luồng realtime socket](./docs/flow_3_realtime_socket.svg)

---

### Luồng 4 — Tạo Private Chat & Group Chat

![Luồng create conversation](./docs/flow_4_create_conversation.svg)

> 💡 **Điểm hay**: Sau khi có `conversationId`, cả private lẫn group chat đều dùng **cùng một cơ chế** — `ChatWindow.jsx` join room socket và `socketHandler.js` broadcast theo room, không cần phân biệt loại chat.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án

### ✅ Yêu Cầu Môi Trường

| Công cụ | Phiên bản tối thiểu |
|---------|---------------------|
| Node.js | >= 18.x |
| npm | >= 9.x |
| MongoDB | >= 6.x (local hoặc Atlas) |
| Git | Bất kỳ |

---

### 1️⃣ Clone Repository

```bash
git clone https://github.com/pathbezo26/NT208_LTWeb_QikLineChat.git
cd QikLineChat
```

---

### 2️⃣ Cài Đặt & Cấu Hình Backend

```bash
# Di chuyển vào thư mục backend
cd backend

# Cài đặt dependencies
npm install
```

Tạo file `.env` trong thư mục `backend/`:

```env
# Cổng chạy server
PORT=5000

# Chuỗi kết nối MongoDB (local hoặc Atlas)
MONGO_URI=mongodb://localhost:27017/webchat

# Khóa bí mật để ký JWT (đặt chuỗi ngẫu nhiên dài)
JWT_SECRET=your_super_secret_key_here

# Thời gian hết hạn JWT
JWT_EXPIRES_IN=7d
```

---

### 3️⃣ Cài Đặt Frontend

```bash
# Mở terminal mới, di chuyển vào thư mục frontend
cd frontend

# Cài đặt dependencies
npm install
```

Kiểm tra file `frontend/src/api/axiosInstance.js` — đảm bảo `baseURL` trỏ đúng địa chỉ backend:

```javascript
// axiosInstance.js
const instance = axios.create({
  baseURL: 'http://localhost:5000/api',
});
```

---

### 4️⃣ Chạy Dự Án

**Cách 1 — Chạy riêng lẻ (2 terminal):**

```bash
# Terminal 1: Chạy Backend
cd backend
npm run dev      # Dùng nodemon (hot reload)
# hoặc: npm start

# Terminal 2: Chạy Frontend
cd frontend
npm run dev
```

**Cách 2 — Chạy đồng thời với `concurrently` (từ thư mục gốc):**

```bash
# Tại thư mục gốc webchat-app/
npm install concurrently --save-dev

# Thêm script này vào package.json gốc:
# "dev": "concurrently \"npm run dev --prefix backend\" \"npm run dev --prefix frontend\""

npm run dev
```

---

### 5️⃣ Truy Cập Ứng Dụng

| Dịch vụ | URL |
|---------|-----|
| 🖥️ Frontend | http://localhost:5173 |
| 🔧 Backend API | http://localhost:5000/api |
| 🗄️ MongoDB (local) | mongodb://localhost:27017/webchat |

---

## 🎮 Cách Sử Dụng

1. **Đăng ký tài khoản**: Truy cập `/register`, điền thông tin và tạo tài khoản mới.
2. **Đăng nhập**: Truy cập `/login`, nhập email và mật khẩu — JWT sẽ được lưu vào `AuthContext`.
3. **Tìm người dùng**: Dùng thanh tìm kiếm `UserSearch` trên Sidebar để tìm user và bắt đầu chat 1-1.
4. **Tạo nhóm chat**: Nhấn nút "Tạo nhóm", nhập tên nhóm và chọn thành viên qua `CreateGroupModal`.
5. **Nhắn tin**: Nhập nội dung vào `ChatInput`, nhấn Enter hoặc nút gửi — tin nhắn xuất hiện realtime cho cả hai phía.
6. **Xem lịch sử**: Nhấn vào bất kỳ cuộc trò chuyện nào trong Sidebar để tải lịch sử tin nhắn.

---

## 📡 API Routes

### 🔐 Auth — `/api/auth`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới | ❌ |
| `POST` | `/api/auth/login` | Đăng nhập, nhận JWT | ❌ |

**Ví dụ body đăng ký:**
```json
{
  "username": "nguyenvana",
  "email": "a@example.com",
  "password": "123456"
}
```

**Ví dụ response đăng nhập:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "_id": "...", "username": "nguyenvana", "email": "a@example.com" }
}
```

---

### 💬 Conversations — `/api/conversations`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/conversations` | Lấy danh sách tất cả conversations của user | ✅ |
| `POST` | `/api/conversations` | Tạo private hoặc group conversation | ✅ |

**Ví dụ body tạo private chat:**
```json
{
  "type": "private",
  "members": ["userId_B"]
}
```

**Ví dụ body tạo group chat:**
```json
{
  "type": "group",
  "name": "Nhóm Đồ Án",
  "members": ["userId_B", "userId_C", "userId_D"]
}
```

---

### 📨 Messages — `/api/messages`

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/api/messages/:conversationId` | Lấy lịch sử tin nhắn của một conversation | ✅ |
| `POST` | `/api/messages` | Lưu tin nhắn mới vào DB | ✅ |

**Ví dụ body gửi tin nhắn:**
```json
{
  "conversationId": "conv_id_here",
  "content": "Xin chào!"
}
```

> ✅ Các route cần **Auth** phải gửi kèm header: `Authorization: Bearer <JWT_TOKEN>`

---

## 🔌 Socket Events

| Event | Hướng | Mô tả |
|-------|-------|-------|
| `connection` | Client → Server | Kết nối socket, kèm `auth.token` để xác thực |
| `disconnect` | Client → Server | Ngắt kết nối socket |
| `joinRoom` | Client → Server | Vào phòng chat theo `conversationId` |
| `leaveRoom` | Client → Server | Rời khỏi phòng chat |
| `sendMessage` | Client → Server | Gửi tin nhắn mới (`{ conversationId, content }`) |
| `newMessage` | Server → Client | Broadcast tin nhắn mới đến toàn bộ room |
| `typing` | Client → Server | Thông báo đang nhập tin nhắn |
| `stopTyping` | Client → Server | Dừng nhập tin nhắn |
| `userOnline` | Server → Client | Thông báo user vừa online |
| `userOffline` | Server → Client | Thông báo user vừa offline |

**Ví dụ sử dụng phía client:**
```javascript
// Vào phòng chat
socket.emit('joinRoom', conversationId);

// Gửi tin nhắn
socket.emit('sendMessage', { conversationId, content: 'Hello!' });

// Lắng nghe tin nhắn mới
socket.on('newMessage', (message) => {
  setMessages(prev => [...prev, message]);
});
```
---
## 🗄️ Thiết Kế Cơ Sở Dữ Liệu

### 📐 Lược Đồ Cơ Sở Dữ Liệu (Schema)

Ứng dụng sử dụng **MongoDB** với 3 collection chính: `users`, `conversations`, `messages`. Dưới đây là chi tiết schema và mối quan hệ giữa các collection.

---

#### 👤 Collection: `users`

Lưu trữ thông tin tài khoản người dùng.

```javascript
// models/User.js
{
  _id:          ObjectId,          // Khóa chính, tự sinh bởi MongoDB
  username:     String,            // Tên hiển thị, bắt buộc, duy nhất
  email:        String,            // Email đăng nhập, bắt buộc, duy nhất
  passwordHash: String,            // Mật khẩu đã mã hóa bcrypt
  createdAt:    Date,              // Thời điểm tạo tài khoản (timestamps)
  updatedAt:    Date               // Thời điểm cập nhật gần nhất (timestamps)
}
```

| Trường | Kiểu | Bắt buộc | Unique | Mô tả |
|--------|------|----------|--------|-------|
| `_id` | ObjectId | ✅ | ✅ | Khóa chính tự sinh |
| `username` | String | ✅ | ✅ | Tên người dùng |
| `email` | String | ✅ | ✅ | Email đăng nhập |
| `passwordHash` | String | ✅ | ❌ | Mật khẩu mã hóa bcrypt |
| `createdAt` | Date | ✅ | ❌ | Tự động (Mongoose timestamps) |

> ⚠️ **Lưu ý quan trọng về `updatedAt`**
>
> Trường `updatedAt` của `conversations` **không tự động cập nhật khi có tin nhắn mới**, vì message được lưu ở collection `messages` riêng.
>
> Vì vậy, sau khi lưu `Message`, backend cần **cập nhật thủ công `Conversation.updatedAt`** để sidebar luôn sort đúng cuộc trò chuyện mới nhất lên đầu.
>
> ```javascript
> await Conversation.findByIdAndUpdate(conversationId, {
>   updatedAt: new Date()
> });
> ```
>
> Thường xử lý trong `socketHandler.js` hoặc `messageController.js` ngay sau bước lưu message.

---

#### 💬 Collection: `conversations`

Lưu trữ thông tin các cuộc trò chuyện (private hoặc group).

```javascript
// models/Conversation.js
{
  _id:       ObjectId,            // Khóa chính
  type:      String,              // "private" | "group"
  name:      String,              // Tên nhóm (chỉ dùng cho group, null nếu private)
  members:   [ObjectId],          // Mảng _id của các thành viên → ref: "User"
  createdBy: ObjectId,            // _id của người tạo → ref: "User"
  createdAt: Date,
  updatedAt: Date                 // Cập nhật mỗi khi có tin nhắn mới (dùng để sort)
}
```

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `_id` | ObjectId | ✅ | Khóa chính tự sinh |
| `type` | String (enum) | ✅ | `"private"` hoặc `"group"` |
| `name` | String | ❌ | Tên nhóm (bỏ trống nếu private) |
| `members` | [ObjectId] | ✅ | Danh sách thành viên (ref → `users`) |
| `createdBy` | ObjectId | ✅ | Người tạo cuộc trò chuyện (ref → `users`) |
| `updatedAt` | Date | ✅ | Dùng để sắp xếp sidebar theo thời gian |

---

#### 📨 Collection: `messages`

Lưu trữ toàn bộ tin nhắn của tất cả các cuộc trò chuyện.

```javascript
// models/Message.js
{
  _id:            ObjectId,       // Khóa chính
  conversationId: ObjectId,       // Thuộc cuộc trò chuyện nào → ref: "Conversation"
  sender:         ObjectId,       // Ai gửi → ref: "User"
  content:        String,         // Nội dung tin nhắn văn bản
  createdAt:      Date,
  updatedAt:      Date
}
```

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `_id` | ObjectId | ✅ | Khóa chính tự sinh |
| `conversationId` | ObjectId | ✅ | Thuộc conversation nào (ref → `conversations`) |
| `sender` | ObjectId | ✅ | Người gửi (ref → `users`) |
| `content` | String | ✅ | Nội dung tin nhắn văn bản |
| `createdAt` | Date | ✅ | Thời điểm gửi, dùng để sắp xếp |

---

#### 🔗 Quan Hệ Giữa Các Collection

```mermaid
erDiagram
    USERS {
        ObjectId _id PK
        string username
        string email
        string passwordHash
        date createdAt
    }

    CONVERSATIONS {
        ObjectId _id PK
        string type
        string name
        ObjectId[] members FK
        ObjectId createdBy FK
        date updatedAt
    }

    MESSAGES {
        ObjectId _id PK
        ObjectId conversationId FK
        ObjectId sender FK
        string content
        date createdAt
    }

    USERS ||--o{ CONVERSATIONS : "tham gia (members[])"
    USERS ||--o{ MESSAGES : "gửi (sender)"
    CONVERSATIONS ||--o{ MESSAGES : "chứa (conversationId)"
```

---

### 🚀 Chiến Lược Lập Chỉ Mục (Indexing)

Indexing giúp tăng tốc độ truy vấn MongoDB đáng kể, đặc biệt quan trọng khi dữ liệu tin nhắn tăng trưởng nhanh.

#### 📌 Index trên Collection `users`

```javascript
// Đăng nhập bằng email (authController.js)
db.users.createIndex({ email: 1 }, { unique: true })  // Unique, tăng tốc login

// Đảm bảo username không trùng
db.users.createIndex({ username: 1 }, { unique: true })
```

| Index | Loại | Lý do |
|-------|------|-------|
| `email_1` | Unique | Tra cứu nhanh khi đăng nhập |
| `username_1` | Unique | Đảm bảo tên không trùng |

---

#### 📌 Index trên Collection `conversations`

```javascript
// Lấy danh sách conversation của user trên Sidebar
db.conversations.createIndex({ members: 1 })

// Sắp xếp theo tin nhắn mới nhất (conversation gần đây lên đầu)
db.conversations.createIndex({ updatedAt: -1 })

// Tổ hợp: lọc theo members + sort theo thời gian (query phổ biến nhất)
db.conversations.createIndex({ members: 1, updatedAt: -1 })

// Kiểm tra private conversation đã tồn tại chưa trước khi tạo mới
db.conversations.createIndex({ type: 1, members: 1 })
```

| Index | Loại | Truy vấn được tối ưu |
|-------|------|---------------------|
| `members_1` | Single | Lấy conversations theo userId |
| `updatedAt_-1` | Single | Sort theo tin nhắn mới nhất |
| `members_1_updatedAt_-1` | Compound | Sidebar query: filter + sort |
| `type_1_members_1` | Compound | Kiểm tra private chat trùng |

---

#### 📌 Index trên Collection `messages`

```javascript
// Lấy lịch sử tin nhắn của một conversation (query quan trọng nhất)
db.messages.createIndex({ conversationId: 1, createdAt: -1 })
```

| Index | Loại | Truy vấn được tối ưu |
|-------|------|---------------------|
| `conversationId_1_createdAt_-1` | Compound | Tải lịch sử tin nhắn theo thứ tự mới nhất |

---

#### 🏗️ Khai Báo Index Trong Mongoose Schema

```javascript
// models/Message.js — Ví dụ khai báo index trực tiếp trong schema
const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: ObjectId, ref: 'Conversation', required: true },
    sender:         { type: ObjectId, ref: 'User', required: true },
    content:        { type: String, required: true },
  },
  { timestamps: true }
);

// Compound index: tối ưu truy vấn lịch sử chat
MessageSchema.index({ conversationId: 1, createdAt: -1 });

// models/Conversation.js
const ConversationSchema = new mongoose.Schema(
  {
    type:      { type: String, enum: ['private', 'group'], required: true },
    name:      { type: String },
    members:   [{ type: ObjectId, ref: 'User', required: true }],
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Compound index: sidebar query (filter members + sort by latest)
ConversationSchema.index({ members: 1, updatedAt: -1 });
ConversationSchema.index({ type: 1, members: 1 });
```

---

#### 📊 Tóm Tắt Toàn Bộ Index

```
Collection: users
  ├── email_1           (unique)     ← đăng nhập
  └── username_1        (unique)     ← đảm bảo không trùng

Collection: conversations
  ├── members_1_updatedAt_-1         ← sidebar (chính)
  └── type_1_members_1               ← kiểm tra private trùng

Collection: messages
  └── conversationId_1_createdAt_-1  ← tải lịch sử (chính)
```

> 💡 **Lưu ý**: Không nên tạo quá nhiều index vì mỗi index tốn thêm dung lượng lưu trữ và làm chậm thao tác **write** (insert/update). Chỉ index những trường thực sự được dùng trong điều kiện `find()`, `sort()`, và `$lookup`.

---
---

## 🔮 Tính năng phát triển

Các tính năng có thể bổ sung trong các phiên bản tiếp theo:

- 😀 **Emoji & Reaction** — thêm emoji picker và react vào tin nhắn
- 🖼️ **Gửi hình ảnh / file** — upload và chia sẻ tệp trong chat
- 🔔 **Thông báo đẩy (Push Notification)** — nhận thông báo kể cả khi không mở tab
- ✅ **Trạng thái tin nhắn** — đã gửi / đã nhận / đã đọc (tick xanh)
- 🌙 **Dark Mode** — hỗ trợ giao diện tối
- 🔍 **Tìm kiếm tin nhắn** — tìm kiếm nội dung trong lịch sử trò chuyện
- 👤 **Hồ sơ người dùng** — cập nhật avatar, tên hiển thị, bio
- 📞 **Gọi video / audio** — tích hợp WebRTC
- 📌 **Ghim tin nhắn** — ghim tin nhắn quan trọng trong nhóm
- 🗑️ **Thu hồi / xóa tin nhắn** — xóa hoặc thu hồi tin nhắn đã gửi

---


Dự án được phát triển phục vụ mục đích học tập. Mọi đóng góp và cải tiến đều được chào đón!

---

<div align="center">
  Made with ❤️ by <strong>Nhóm 18</strong> • 2026
</div>


[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://react.dev/
[Node.js]: https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white
[Node-url]: https://nodejs.org/
[MongoDB.js]: https://img.shields.io/badge/MongoDB-4ea94b?style=for-the-badge&logo=mongodb&logoColor=white
[MongoDB-url]: https://www.mongodb.com/
[SocketIO.js]: https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white
[SocketIO-url]: https://socket.io/
[Express.js]: https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white
[Express-url]: https://expressjs.com/
[Vite.js]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vitejs.dev/
[JWT.js]: https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white
[JWT-url]: https://jwt.io/
