(function () {
  const DB_NAME = "digital-world-books-cache";
  const DB_VERSION = 1;
  const TEXT_STORE = "text";
  const TRANSLATION_STORE = "translation";
  const CACHE_VERSION = 1;
  const LIST_TRANSLATE_KEY = "digital-world-books-list-translate-v1";
  const MAX_TEXT_ENTRIES = 25;
  const MAX_TRANSLATION_ENTRIES = 25;

  let dbPromise = null;

  function supportsIndexedDb() {
    return typeof indexedDB !== "undefined";
  }

  function openDb() {
    if (!supportsIndexedDb()) {
      return Promise.reject(new Error("IndexedDB unavailable"));
    }
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TEXT_STORE)) {
          const store = db.createObjectStore(TEXT_STORE, { keyPath: "bookId" });
          store.createIndex("cachedAt", "cachedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(TRANSLATION_STORE)) {
          const store = db.createObjectStore(TRANSLATION_STORE, { keyPath: "bookId" });
          store.createIndex("cachedAt", "cachedAt", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function storeGet(store, key) {
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  function storePut(store, value) {
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function storeDelete(store, key) {
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function storeGetAll(store) {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function withStore(storeName, mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      Promise.resolve(fn(store))
        .then((r) => {
          result = r;
        })
        .catch((err) => reject(err));
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function trimStore(storeName, maxEntries) {
    const rows = await withStore(storeName, "readonly", (store) => storeGetAll(store));
    if (rows.length <= maxEntries) return;
    rows.sort((a, b) => (a.cachedAt || 0) - (b.cachedAt || 0));
    const excess = rows.length - maxEntries;
    const toDelete = rows.slice(0, excess);
    await withStore(storeName, "readwrite", async (store) => {
      for (const row of toDelete) {
        await storeDelete(store, row.bookId);
      }
    });
  }

  async function getText(bookId) {
    if (!bookId || !supportsIndexedDb()) return null;
    try {
      const row = await withStore(TEXT_STORE, "readonly", (store) => storeGet(store, bookId));
      if (!row || row.version !== CACHE_VERSION || row.partial) return null;
      if (!row.text) return null;
      return row;
    } catch {
      return null;
    }
  }

  async function putText(entry) {
    if (!entry?.bookId || !entry.text || !supportsIndexedDb()) return;
    try {
      const payload = {
        bookId: entry.bookId,
        version: CACHE_VERSION,
        cachedAt: Date.now(),
        id: entry.id ?? entry.bookId,
        title: entry.title || "",
        authors: entry.authors || "",
        text: entry.text,
        partial: false,
        textLength: entry.text.length
      };
      await withStore(TEXT_STORE, "readwrite", (store) => storePut(store, payload));
      await trimStore(TEXT_STORE, MAX_TEXT_ENTRIES);
    } catch {
      /* quota or private mode */
    }
  }

  async function getTranslation(bookId) {
    if (!bookId || !supportsIndexedDb()) return null;
    try {
      const row = await withStore(TRANSLATION_STORE, "readonly", (store) => storeGet(store, bookId));
      if (!row || row.version !== CACHE_VERSION) return null;
      return row;
    } catch {
      return null;
    }
  }

  async function putTranslation(entry) {
    if (!entry?.bookId || !supportsIndexedDb()) return;
    if (!entry.preparedTextSnapshot) return;
    const batchKeys = Object.keys(entry.translatedBatches || {});
    const chunkKeys = Object.keys(entry.translatedChunks || {});
    if (!batchKeys.length && !chunkKeys.length) return;
    try {
      const payload = {
        bookId: entry.bookId,
        version: CACHE_VERSION,
        cachedAt: Date.now(),
        preparedTextSnapshot: entry.preparedTextSnapshot,
        translatedBatches: entry.translatedBatches || {},
        translatedChunks: entry.translatedChunks || {}
      };
      await withStore(TRANSLATION_STORE, "readwrite", (store) => storePut(store, payload));
      await trimStore(TRANSLATION_STORE, MAX_TRANSLATION_ENTRIES);
    } catch {
      /* ignore */
    }
  }

  async function deleteTranslation(bookId) {
    if (!bookId || !supportsIndexedDb()) return;
    try {
      await withStore(TRANSLATION_STORE, "readwrite", (store) => storeDelete(store, bookId));
    } catch {
      /* ignore */
    }
  }

  function loadListTranslations() {
    try {
      const raw = localStorage.getItem(LIST_TRANSLATE_KEY);
      if (!raw) return new Map();
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return new Map();
      return new Map(
        Object.entries(obj).map(([k, v]) => [Number(k) || k, v])
      );
    } catch {
      return new Map();
    }
  }

  function persistListTranslation(bookId, data) {
    if (!bookId || !data) return;
    try {
      const map = loadListTranslations();
      map.set(bookId, data);
      const obj = {};
      for (const [id, val] of map.entries()) {
        obj[String(id)] = val;
      }
      localStorage.setItem(LIST_TRANSLATE_KEY, JSON.stringify(obj));
    } catch {
      /* storage full */
    }
  }

  window.BooksCache = {
    CACHE_VERSION,
    getText,
    putText,
    getTranslation,
    putTranslation,
    deleteTranslation,
    loadListTranslations,
    persistListTranslation
  };
})();
