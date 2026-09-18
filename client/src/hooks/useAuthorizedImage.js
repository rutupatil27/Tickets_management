import { useEffect, useState } from 'react';
import messageApi from '../services/messageApi.js';

/**
 * One download per photo URL for the whole session, shared by every component
 * that shows it (the chat bubble and the lightbox), so scrolling or opening a
 * photo never re-fetches it. Failed downloads are evicted so a retry can work.
 */
const blobCache = new Map();

function loadBlob(url) {
  if (!blobCache.has(url)) {
    const request = messageApi.fetchAttachment(url).catch((error) => {
      blobCache.delete(url);
      throw error;
    });
    blobCache.set(url, request);
  }
  return blobCache.get(url);
}

/** Clears cached photos, e.g. on logout, so they never outlive the session. */
export function clearAuthorizedImageCache() {
  blobCache.clear();
}

/**
 * Loads an attachment through the authenticated API and returns a local
 * object URL for <img src>. The object URL is revoked when the component
 * unmounts or the URL changes, so memory is released.
 */
export function useAuthorizedImage(url) {
  const [state, setState] = useState({ src: null, loading: Boolean(url), error: null });

  useEffect(() => {
    if (!url) {
      setState({ src: null, loading: false, error: null });
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;
    setState({ src: null, loading: true, error: null });

    loadBlob(url)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ src: objectUrl, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ src: null, loading: false, error });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return state;
}

export default useAuthorizedImage;
