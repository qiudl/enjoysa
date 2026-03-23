import React, { useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookmarkCheck, Plus, X, BookmarkX } from 'lucide-react';
import { useBookmarks } from '../../../hooks/useBookmarks';
import styles from './BookmarkPanel.module.css';

export const BookmarkPanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { bookmarks, addBookmark, removeBookmark, isBookmarked } = useBookmarks();
  const [open, setOpen] = React.useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentBookmarked = isBookmarked(location.pathname);

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleAddCurrent = () => {
    const title = document.title || location.pathname;
    addBookmark(location.pathname, title);
  };

  const handleItemClick = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        className={`${styles.bookmarkBtn} ${currentBookmarked ? styles.active : ''}`}
        onClick={() => setOpen(!open)}
        title={t('supplier.bookmarks.title')}
      >
        {currentBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        {bookmarks.length > 0 && (
          <span className={styles.bookmarkCount}>{bookmarks.length}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>{t('supplier.bookmarks.title')}</span>
            <button
              className={styles.addBtn}
              onClick={handleAddCurrent}
              disabled={currentBookmarked}
            >
              <Plus size={14} />
              {currentBookmarked
                ? t('supplier.bookmarks.alreadyAdded')
                : t('supplier.bookmarks.addCurrent')}
            </button>
          </div>

          <div className={styles.list}>
            {bookmarks.length === 0 ? (
              <div className={styles.empty}>
                <BookmarkX size={32} className={styles.emptyIcon} />
                <p className={styles.emptyText}>{t('supplier.bookmarks.empty')}</p>
              </div>
            ) : (
              bookmarks.map((bm) => (
                <div
                  key={bm.path}
                  className={styles.item}
                  onClick={() => handleItemClick(bm.path)}
                >
                  <div className={styles.itemInfo}>
                    <div className={styles.itemTitle}>{bm.title}</div>
                    <div className={styles.itemPath}>{bm.path}</div>
                  </div>
                  <button
                    className={styles.removeBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBookmark(bm.path);
                    }}
                    title={t('common.delete')}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookmarkPanel;
