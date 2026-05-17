import { useState } from 'react';

export default function UserAvatar({ user, name, src, className, title, fallback = '?' }) {
    const [failedUrl, setFailedUrl] = useState('');
    const avatarUrl = src || user?.avatar?.url;
    const displayName = name || user?.username || '';
    const firstLetter = displayName ? displayName.charAt(0).toUpperCase() : fallback;
    const canShowImage = avatarUrl && failedUrl !== avatarUrl;

    if (canShowImage) {
        return (
            <img
                className={className}
                data-avatar-type="image"
                src={avatarUrl}
                alt={displayName || 'Avatar'}
                title={title || displayName}
                onError={() => setFailedUrl(avatarUrl)}
            />
        );
    }

    return (
        <span className={className} data-avatar-type="fallback" title={title || displayName}>
            {firstLetter}
        </span>
    );
}
