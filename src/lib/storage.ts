import { SessionRecord, QuestionItem } from './types';

const DB_NAME = 'EchoInterviewCopilotDB';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const FAVORITES_STORE = 'favorites';
const CUSTOM_QUESTIONS_STORE = 'customQuestions';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
        db.createObjectStore(FAVORITES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CUSTOM_QUESTIONS_STORE)) {
        db.createObjectStore(CUSTOM_QUESTIONS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ----------------- SESSIONS -----------------

export async function getAllSessions(): Promise<SessionRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result as SessionRecord[]).sort((a, b) => b.createdAt - a.createdAt);
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('copilot_sessions');
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  }
}

export async function saveSession(session: SessionRecord): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.put(session);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const sessions = await getAllSessions();
      const existingIdx = sessions.findIndex(s => s.id === session.id);
      if (existingIdx >= 0) {
        sessions[existingIdx] = session;
      } else {
        sessions.unshift(session);
      }
      localStorage.setItem('copilot_sessions', JSON.stringify(sessions));
    }
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const sessions = (await getAllSessions()).filter(s => s.id !== id);
      localStorage.setItem('copilot_sessions', JSON.stringify(sessions));
    }
  }
}

// ----------------- FAVORITES -----------------

export async function getFavoriteQuestionIds(): Promise<string[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FAVORITES_STORE, 'readonly');
      const store = tx.objectStore(FAVORITES_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        resolve((req.result as { id: string }[]).map(item => item.id));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('copilot_favorites');
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  }
}

export async function toggleFavoriteQuestion(id: string): Promise<boolean> {
  const currentFavs = await getFavoriteQuestionIds();
  const isFav = currentFavs.includes(id);

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FAVORITES_STORE, 'readwrite');
      const store = tx.objectStore(FAVORITES_STORE);
      if (isFav) {
        const req = store.delete(id);
        req.onsuccess = () => resolve(false);
        req.onerror = () => reject(req.error);
      } else {
        const req = store.put({ id, addedAt: Date.now() });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      }
    });
  } catch {
    if (typeof window !== 'undefined') {
      const updated = isFav ? currentFavs.filter(f => f !== id) : [...currentFavs, id];
      localStorage.setItem('copilot_favorites', JSON.stringify(updated));
      return !isFav;
    }
    return !isFav;
  }
}

// ----------------- CUSTOM QUESTIONS -----------------

export async function getCustomQuestions(): Promise<QuestionItem[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CUSTOM_QUESTIONS_STORE, 'readonly');
      const store = tx.objectStore(CUSTOM_QUESTIONS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as QuestionItem[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('copilot_custom_questions');
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  }
}

export async function saveCustomQuestion(question: QuestionItem): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CUSTOM_QUESTIONS_STORE, 'readwrite');
      const store = tx.objectStore(CUSTOM_QUESTIONS_STORE);
      const req = store.put(question);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const items = await getCustomQuestions();
      items.unshift(question);
      localStorage.setItem('copilot_custom_questions', JSON.stringify(items));
    }
  }
}
