import { useCallback, useEffect, useRef, useState } from 'react';
import { Drawer, Empty, Input, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { searchMessagesAPI } from '../api/messageAPI';
import UserAvatar from './UserAvatar';
import styles from './styles/MessageSearchDrawer.module.css';

const SEARCH_PAGE_SIZE = 20;

const normalizeSearchText = (value = '') => {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u0111\u0110]/g, 'd')
        .toLowerCase();
};

const formatResultTime = (createdAt) => {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const renderHighlightedText = (text = '', keyword = '') => {
    const safeKeyword = keyword.trim();
    if (!safeKeyword) return text;

    const term = normalizeSearchText(safeKeyword).trim();
    if (!term) return text;

    let normalizedText = '';
    const indexMap = [];
    Array.from(text).forEach((char, originalIndex) => {
        const normalizedChar = normalizeSearchText(char);
        Array.from(normalizedChar).forEach((normalizedPart) => {
            normalizedText += normalizedPart;
            indexMap.push(originalIndex);
        });
    });

    const ranges = [];
    let fromIndex = 0;
    while (fromIndex < normalizedText.length) {
        const matchIndex = normalizedText.indexOf(term, fromIndex);
        if (matchIndex < 0) break;

        const originalStart = indexMap[matchIndex];
        const originalEnd = (indexMap[matchIndex + term.length - 1] ?? originalStart) + 1;
        ranges.push([originalStart, originalEnd]);
        fromIndex = matchIndex + term.length;
    }

    const mergedRanges = ranges
        .sort((first, second) => first[0] - second[0])
        .reduce((items, range) => {
            const previous = items.at(-1);
            if (!previous || range[0] > previous[1]) return [...items, range];

            previous[1] = Math.max(previous[1], range[1]);
            return items;
        }, []);

    if (mergedRanges.length === 0) return text;

    const output = [];
    let cursor = 0;
    mergedRanges.forEach(([start, end], index) => {
        if (cursor < start) output.push(text.slice(cursor, start));
        output.push(<mark key={`${start}-${end}-${index}`}>{text.slice(start, end)}</mark>);
        cursor = end;
    });
    if (cursor < text.length) output.push(text.slice(cursor));

    return output;
};

export default function MessageSearchDrawer({
    open,
    onClose,
    conversationId,
    onSelectMessage,
}) {
    const [keyword, setKeyword] = useState('');
    const [searchedKeyword, setSearchedKeyword] = useState('');
    const [messages, setMessages] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [activeMessageId, setActiveMessageId] = useState(null);
    const requestIdRef = useRef(0);
    const listRef = useRef(null);
    const searchDebounceRef = useRef(null);

    useEffect(() => {
        if (!open) return;

        clearTimeout(searchDebounceRef.current);
        setKeyword('');
        setSearchedKeyword('');
        setMessages([]);
        setNextCursor(null);
        setHasMore(false);
        setActiveMessageId(null);
    }, [conversationId, open]);

    const runSearch = useCallback(async (value, cursor = null) => {
        const cleanKeyword = value.trim();
        if (!conversationId || !cleanKeyword) {
            setSearchedKeyword('');
            setMessages([]);
            setNextCursor(null);
            setHasMore(false);
            setActiveMessageId(null);
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        const isLoadingNextPage = Boolean(cursor);

        if (isLoadingNextPage) {
            setIsLoadingMore(true);
        } else {
            setIsSearching(true);
            setSearchedKeyword(cleanKeyword);
            setMessages([]);
            setActiveMessageId(null);
        }

        try {
            const data = await searchMessagesAPI(conversationId, cleanKeyword, {
                before: cursor || undefined,
                limit: SEARCH_PAGE_SIZE,
            });

            if (requestIdRef.current !== requestId) return;

            setMessages((currentMessages) => {
                const nextMessages = isLoadingNextPage
                    ? [...currentMessages, ...(data.messages || [])]
                    : data.messages || [];
                const deduped = new Map();
                nextMessages.forEach((message) => {
                    if (message?._id) deduped.set(message._id, message);
                });

                return Array.from(deduped.values());
            });
            setNextCursor(data.nextCursor || null);
            setHasMore(Boolean(data.hasMore && data.nextCursor));
        } catch (error) {
            console.error('Search messages error:', error);
        } finally {
            if (requestIdRef.current === requestId) {
                setIsSearching(false);
                setIsLoadingMore(false);
            }
        }
    }, [conversationId]);

    useEffect(() => {
        if (!open) return;

        clearTimeout(searchDebounceRef.current);
        const cleanKeyword = keyword.trim();

        if (!cleanKeyword) {
            setSearchedKeyword('');
            setMessages([]);
            setNextCursor(null);
            setHasMore(false);
            setActiveMessageId(null);
            setIsSearching(false);
            setIsLoadingMore(false);
            return;
        }

        searchDebounceRef.current = setTimeout(() => {
            runSearch(cleanKeyword);
        }, 350);

        return () => clearTimeout(searchDebounceRef.current);
    }, [keyword, open, runSearch]);

    const handleSubmit = () => {
        runSearch(keyword);
    };

    const handleSelectMessage = (message) => {
        setActiveMessageId(message._id);
        onSelectMessage?.(message, searchedKeyword || keyword);
    };

    const loadMore = useCallback(() => {
        if (!searchedKeyword || !hasMore || !nextCursor || isSearching || isLoadingMore) return;

        runSearch(searchedKeyword, nextCursor);
    }, [hasMore, isLoadingMore, isSearching, nextCursor, runSearch, searchedKeyword]);

    const handleResultScroll = useCallback(() => {
        const list = listRef.current;
        if (!list) return;

        const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
        if (distanceFromBottom > 120) return;

        loadMore();
    }, [loadMore]);

    useEffect(() => {
        if (!searchedKeyword || !hasMore || isLoadingMore || isSearching) return;

        const list = listRef.current;
        if (!list) {
            loadMore();
            return;
        }
        if (list.scrollHeight > list.clientHeight + 8) return;

        loadMore();
    }, [hasMore, isLoadingMore, isSearching, loadMore, messages.length, searchedKeyword]);

    return (
        <Drawer
            title="Search messages"
            open={open}
            onClose={onClose}
            width={420}
            className={styles.drawer}
        >
            <div className={styles.searchBox}>
                <Input.Search
                    allowClear
                    autoFocus
                    value={keyword}
                    loading={isSearching}
                    prefix={<SearchOutlined />}
                    placeholder="Search in conversation"
                    onChange={(event) => {
                        const nextValue = event.target.value;
                        setKeyword(nextValue);

                        if (!nextValue.trim()) {
                            setSearchedKeyword('');
                            setMessages([]);
                            setNextCursor(null);
                            setHasMore(false);
                            setActiveMessageId(null);
                        }
                    }}
                    onSearch={handleSubmit}
                />
            </div>

            {!searchedKeyword && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Type a keyword to search messages" />
            )}

            {searchedKeyword && isSearching && messages.length === 0 && (
                <div className={styles.loading}>
                    <Spin size="small" />
                </div>
            )}

            {searchedKeyword && !isSearching && messages.length === 0 && !hasMore && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching messages" />
            )}

            {searchedKeyword && !isSearching && messages.length === 0 && hasMore && (
                <div className={styles.loading}>
                    <Spin size="small" />
                </div>
            )}

            {messages.length > 0 && (
                <div className={styles.resultList} onScroll={handleResultScroll} ref={listRef}>
                    {messages.map((message) => (
                        <button
                            className={`${styles.resultRow} ${activeMessageId === message._id ? styles.activeResult : ''}`}
                            key={message._id}
                            onClick={() => handleSelectMessage(message)}
                            type="button"
                        >
                            <UserAvatar
                                user={message.sender}
                                name={message.sender?.username || 'User'}
                                className={styles.avatar}
                            />
                            <span className={styles.resultContent}>
                                <span className={styles.resultTopLine}>
                                    <strong>{message.sender?.username || 'User'}</strong>
                                    <time>{formatResultTime(message.createdAt)}</time>
                                </span>
                                <span className={styles.resultSnippet}>
                                    {renderHighlightedText(message.searchSnippet || message.content, searchedKeyword)}
                                </span>
                            </span>
                        </button>
                    ))}

                    {hasMore && (
                        <div className={styles.loadMoreStatus}>
                            {isLoadingMore ? <Spin size="small" /> : 'Scroll for older matches'}
                        </div>
                    )}
                </div>
            )}
        </Drawer>
    );
}
