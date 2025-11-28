/**
 * File Storage Utility - Persists imported files using IndexedDB
 * IndexedDB is used instead of localStorage because:
 * 1. It can handle large files (STL files can be several MB)
 * 2. It stores binary data efficiently
 * 3. It has much higher storage limits than localStorage (~5MB)
 */

const DB_NAME = 'scad-forge-files';
const DB_VERSION = 1;
const STORE_NAME = 'imported-files';

export interface StoredFile {
  name: string;
  data: ArrayBuffer;
  size: number;
  type: string;
  timestamp: number;
}

/**
 * Open the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create the object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'name' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('[FileStorage] Created IndexedDB store');
      }
    };
  });
}

/**
 * Save a file to IndexedDB
 */
export async function saveFile(file: StoredFile): Promise<void> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.put(file);
      
      request.onsuccess = () => {
        console.log(`[FileStorage] Saved file: ${file.name}`);
        resolve();
      };
      
      request.onerror = () => {
        console.error(`[FileStorage] Failed to save file: ${file.name}`, request.error);
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[FileStorage] Save error:', error);
    throw error;
  }
}

/**
 * Save multiple files to IndexedDB
 */
export async function saveFiles(files: StoredFile[]): Promise<void> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      let completed = 0;
      let hasError = false;
      
      for (const file of files) {
        const request = store.put(file);
        
        request.onsuccess = () => {
          completed++;
          if (completed === files.length && !hasError) {
            console.log(`[FileStorage] Saved ${files.length} files`);
            resolve();
          }
        };
        
        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            console.error(`[FileStorage] Failed to save file: ${file.name}`, request.error);
            reject(request.error);
          }
        };
      }
      
      // Handle empty array
      if (files.length === 0) {
        resolve();
      }
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[FileStorage] Save files error:', error);
    throw error;
  }
}

/**
 * Load all files from IndexedDB
 */
export async function loadAllFiles(): Promise<StoredFile[]> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const files = request.result || [];
        console.log(`[FileStorage] Loaded ${files.length} files from storage`);
        resolve(files);
      };
      
      request.onerror = () => {
        console.error('[FileStorage] Failed to load files:', request.error);
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[FileStorage] Load error:', error);
    return [];
  }
}

/**
 * Load a specific file from IndexedDB
 */
export async function loadFile(name: string): Promise<StoredFile | null> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get(name);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        console.error(`[FileStorage] Failed to load file: ${name}`, request.error);
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[FileStorage] Load file error:', error);
    return null;
  }
}

/**
 * Delete a file from IndexedDB
 */
export async function deleteFile(name: string): Promise<void> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(name);
      
      request.onsuccess = () => {
        console.log(`[FileStorage] Deleted file: ${name}`);
        resolve();
      };
      
      request.onerror = () => {
        console.error(`[FileStorage] Failed to delete file: ${name}`, request.error);
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[FileStorage] Delete error:', error);
    throw error;
  }
}

/**
 * Clear all files from IndexedDB
 */
export async function clearAllFiles(): Promise<void> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('[FileStorage] Cleared all files');
        resolve();
      };
      
      request.onerror = () => {
        console.error('[FileStorage] Failed to clear files:', request.error);
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[FileStorage] Clear error:', error);
    throw error;
  }
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

