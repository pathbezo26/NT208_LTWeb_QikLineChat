import React from 'react';

function Avatar({ name, size = 45 }) {
    const firstLetter = name ? name.charAt(0).toUpperCase() : '?';

    // 2. Hàm tạo màu nền dựa trên ký tự (giúp chữ cái nào cũng có 1 màu riêng biệt)
    const getAvatarColor = (letter) => {
        const colors = [
            '#f56a00', '#7265e6', '#ffbf00', '#00a2ae', 
            '#f5317f', '#1890ff', '#52c41a', '#eb2f96'
        ];
        // Dùng mã ASCII của chữ cái để chọn màu trong mảng
        const charCode = letter.charCodeAt(0) || 0;
        return colors[charCode % colors.length];
    };

    const bgColor = getAvatarColor(firstLetter);
    const avatarStyle = {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: bgColor,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${size / 2}px`,
        fontWeight: 'bold',
        flexShrink: 0
    };

    return (
        <div style={avatarStyle} title={name}>
            {firstLetter}
        </div>
    );
}

export default Avatar;