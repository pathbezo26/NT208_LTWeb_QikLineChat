import { SearchOutlined } from '@ant-design/icons';
import styles from './styles/SidebarSearch.module.css';

export default function SidebarSearch({ value, onChange, placeholder = 'Search' }) {
    return (
        <div className={styles.searchBox}>
            <SearchOutlined className={styles.searchIcon} />
            <input
                className={styles.searchInput}
                type="text"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
            />
        </div>
    );
}
