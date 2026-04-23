// Format thời gian hiển thị cho tin nhắn
// Ví dụ: "14:35", "Hôm qua", "20/04"

const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();

    // Tính số ngày chênh lệch giữa tin nhắn và hiện tại
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((todayStart - dateStart) / (1000 * 60 * 60 * 24));

    // Lấy giờ:phút (luôn hiển thị 2 chữ số, ví dụ: 08:05)
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (diffDays === 0) return timeStr;           // Hôm nay → chỉ hiện giờ
    if (diffDays === 1) return `Hôm qua`;         // Hôm qua
    if (diffDays < 7) return `${diffDays} ngày trước`; // Trong tuần

    // Lâu hơn 1 tuần → hiển thị ngày/tháng
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
};

// Format đầy đủ khi hover vào tin nhắn
// Ví dụ: "14:35 - Thứ Ba, 20/04/2025"
const formatFullTime = (dateString) => {
    const date = new Date(dateString);
    const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const dayName = days[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${hours}:${minutes} - ${dayName}, ${day}/${month}/${year}`;
};

export { formatTime, formatFullTime };