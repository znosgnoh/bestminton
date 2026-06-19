// IndexedDB low-level utilities — browser only.
const DB_NAME = "bestminton_local";
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("members")) {
        db.createObjectStore("members", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("matches")) {
        db.createObjectStore("matches", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("registrations")) {
        const s = db.createObjectStore("registrations", { keyPath: "id", autoIncrement: true });
        s.createIndex("matchId", "matchId", { unique: false });
        s.createIndex("memberId", "memberId", { unique: false });
      }
      if (!db.objectStoreNames.contains("guests")) {
        const s = db.createObjectStore("guests", { keyPath: "id", autoIncrement: true });
        s.createIndex("registrationId", "registrationId", { unique: false });
      }
    };

    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

export function idbGetAll<T>(storeName: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      })
  );
}

export function idbGetById<T>(storeName: string, id: number): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(storeName, "readonly").objectStore(storeName).get(id);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      })
  );
}

export function idbGetByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db
          .transaction(storeName, "readonly")
          .objectStore(storeName)
          .index(indexName)
          .getAll(value);
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      })
  );
}

export function idbAdd<T extends object>(storeName: string, data: T): Promise<number> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(storeName, "readwrite").objectStore(storeName).add(data);
        req.onsuccess = () => resolve(req.result as number);
        req.onerror = () => reject(req.error);
      })
  );
}

export function idbPut<T extends object>(storeName: string, data: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(storeName, "readwrite").objectStore(storeName).put(data);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

export function idbDelete(storeName: string, id: number): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(storeName, "readwrite").objectStore(storeName).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}
