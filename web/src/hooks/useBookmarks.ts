import { useState, useCallback, useEffect } from 'react';

export interface Bookmark {
  path: string;
  title: string;
  timestamp: number;
}

const STORAGE_KEY = 'enjoysa_supplier_bookmarks';
const MAX_BOOKMARKS = 20;

function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(loadBookmarks);

  useEffect(() => {
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  const addBookmark = useCallback((path: string, title: string) => {
    setBookmarks(prev => {
      if (prev.some(b => b.path === path)) return prev;
      const next = [{ path, title, timestamp: Date.now() }, ...prev];
      return next.slice(0, MAX_BOOKMARKS);
    });
  }, []);

  const removeBookmark = useCallback((path: string) => {
    setBookmarks(prev => prev.filter(b => b.path !== path));
  }, []);

  const isBookmarked = useCallback((path: string) => {
    return bookmarks.some(b => b.path === path);
  }, [bookmarks]);

  return { bookmarks, addBookmark, removeBookmark, isBookmarked };
}
