import { useState, useEffect, useRef, useCallback } from 'react';
import type { Todo, TodoFilter } from './utils/todoTypes';
import TodoList from './components/TodoList';
import { DataMergeModal } from './components/DataMergeModal';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';
import { exportTodosAsExcel } from './utils/excelExport';
import { useToast } from './contexts/ToastContext';
import { useAuth } from './contexts/AuthContext';
import { CommandPalette } from './components/CommandPalette';
import { useConfetti } from './hooks/useConfetti';
import { 
  saveTodosToCloud, 
  loadTodosFromCloud, 
  saveTodoToCloud, 
  deleteTodoFromCloud,
  mergeTodos 
} from './firebase/todoService';

// IndexedDB implementation for local storage (fallback/offline support)
const DB_NAME = 'TodoListDB';
const DB_VERSION = 2; // Increment version to add pendingOps store
const STORE_NAME = 'todos';

let db: IDBDatabase | null = null;

// Queue for offline operations
interface PendingOperation {
  type: 'add' | 'update' | 'delete';
  todoId: string;
  todo?: Todo;
}

// Helper to get last synced user ID
const getLastSyncedUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('lastSyncedUserId');
  } catch {
    return null;
  }
};

// Helper to set last synced user ID
const setLastSyncedUserId = (userId: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (userId) {
      localStorage.setItem('lastSyncedUserId', userId);
    } else {
      localStorage.removeItem('lastSyncedUserId');
    }
  } catch (error) {
    console.error('Failed to set last synced user:', error);
  }
};

const getStoredDarkMode = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const readBoolean = (value: string | null) => {
    if (!value) return null;
    try {
      return JSON.parse(value) as boolean;
    } catch {
      return null;
    }
  };

  try {
    const fromLocal = readBoolean(localStorage.getItem('darkMode'));
    if (fromLocal !== null) return fromLocal;

    const fromSession = readBoolean(sessionStorage.getItem('darkMode'));
    if (fromSession !== null) return fromSession;
  } catch (error) {
    console.error('Failed to read stored dark mode:', error);
  }

  return false;
};

const promisifyRequest = <T,>(request: IDBRequest<T>): Promise<T> =>
   new Promise((resolve, reject) => {
     request.onsuccess = () => resolve(request.result);
     request.onerror = () => reject(request.error);
   });

 const waitForTransaction = (tx: IDBTransaction): Promise<void> =>
   new Promise((resolve, reject) => {
     tx.oncomplete = () => resolve();
     tx.onabort = () => reject(tx.error);
     tx.onerror = () => reject(tx.error);
   });

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;
      
      // Create todos store (version 1)
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      
      // Create pending operations store (version 2)
      if (oldVersion < 2 && !database.objectStoreNames.contains('pendingOps')) {
        database.createObjectStore('pendingOps', { keyPath: 'todoId' });
      }
    };
  });
};

const saveTodosToDB = async (todos: Todo[]) => {
  try {
    if (!db) {
      db = await initDB();
    }

    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await promisifyRequest(store.clear());

    for (const todo of todos) {
      await promisifyRequest(store.put(todo));
    }

    await waitForTransaction(transaction);
  } catch (error) {
    console.error('Failed to save to IndexedDB:', error);
    try {
      sessionStorage.setItem('todos', JSON.stringify(todos));
    } catch (sessionError) {
      console.error('Failed to save to sessionStorage:', sessionError);
    }
  }
};

const loadTodosFromDB = async (): Promise<Todo[]> => {
  try {
    if (!db) {
      db = await initDB();
    }

    const transaction = db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const todos = (await promisifyRequest(store.getAll())) ?? [];
    await waitForTransaction(transaction);

    return (todos as any[]).map((todo: any) => ({
      ...todo,
      createdAt: todo.createdAt ? new Date(todo.createdAt) : new Date(),
    }));
  } catch (error) {
    console.error('Failed to load from IndexedDB:', error);
    
    try {
      const saved = sessionStorage.getItem('todos');
      if (saved) {
        const todos = JSON.parse(saved);
        return todos.map((todo: any) => ({
          ...todo,
          createdAt: todo.createdAt ? new Date(todo.createdAt) : new Date()
        }));
      }
    } catch (sessionError) {
      console.error('Failed to load from sessionStorage:', sessionError);
    }
    
    return [];
  }
};

// Save pending operation for offline sync
const savePendingOperation = async (operation: PendingOperation) => {
  try {
    if (!db) {
      db = await initDB();
    }
    // Check if store exists
    if (!db!.objectStoreNames.contains('pendingOps')) {
      console.warn('pendingOps store not found, skipping offline queue');
      return;
    }
    const transaction = db!.transaction(['pendingOps'], 'readwrite');
    const store = transaction.objectStore('pendingOps');
    await promisifyRequest(store.put(operation));
    await waitForTransaction(transaction);
  } catch (error) {
    console.error('Failed to save pending operation:', error);
  }
};

// Load pending operations
const loadPendingOperations = async (): Promise<PendingOperation[]> => {
  try {
    if (!db) {
      db = await initDB();
    }
    // Check if store exists
    if (!db!.objectStoreNames.contains('pendingOps')) {
      return [];
    }
    const transaction = db!.transaction(['pendingOps'], 'readonly');
    const store = transaction.objectStore('pendingOps');
    const ops = await promisifyRequest(store.getAll());
    await waitForTransaction(transaction);
    return (ops as PendingOperation[]) || [];
  } catch (error) {
    console.error('Failed to load pending operations:', error);
    return [];
  }
};

// Clear pending operation
const clearPendingOperation = async (todoId: string) => {
  try {
    if (!db) {
      db = await initDB();
    }
    // Check if store exists
    if (!db!.objectStoreNames.contains('pendingOps')) {
      return;
    }
    const transaction = db!.transaction(['pendingOps'], 'readwrite');
    const store = transaction.objectStore('pendingOps');
    await promisifyRequest(store.delete(todoId));
    await waitForTransaction(transaction);
  } catch (error) {
    console.error('Failed to clear pending operation:', error);
  }
};

const csvHeaders = ['id', 'text', 'completed', 'createdAt', 'priority', 'note'] as const;

const escapeCSV = (value: string) => {
  const stringValue = value.replace(/"/g, '""');
  return `"${stringValue}"`;
};

const splitCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
};

const getStoredUserName = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return localStorage.getItem('userName') || sessionStorage.getItem('userName') || '';
  } catch (error) {
    console.error('Failed to read stored user name:', error);
    return '';
  }
};

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<TodoFilter>('all');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = getStoredDarkMode();
    if (typeof document !== 'undefined') {
      if (stored) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    return stored;
  });
  const [userName, setUserName] = useState(() => getStoredUserName());
  const [hydrated, setHydrated] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();
  const { user, loading: authLoading, signInWithGoogle, logout, isAuthenticated } = useAuth();
  const { triggerSuccess, triggerCelebration } = useConfetti();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const deletedTodoRef = useRef<{ todo: Todo; index: number } | null>(null);
  
  // Data merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [pendingCloudTodos, setPendingCloudTodos] = useState<Todo[]>([]);
  const [pendingLocalTodos, setPendingLocalTodos] = useState<Todo[]>([]);
  const hasShownMergeModal = useRef(false);
  
  // Logout confirm modal state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Process pending operations when coming back online
  const processPendingOperations = useCallback(async () => {
    if (!user) return;
    
    const pendingOps = await loadPendingOperations();
    if (pendingOps.length === 0) return;
    
    let successCount = 0;
    let failCount = 0;
    
    for (const op of pendingOps) {
      try {
        if (op.type === 'delete') {
          await deleteTodoFromCloud(user.uid, op.todoId);
        } else if (op.type === 'add' || op.type === 'update') {
          if (op.todo) {
            await saveTodoToCloud(user.uid, op.todo);
          }
        }
        await clearPendingOperation(op.todoId);
        successCount++;
      } catch (error) {
        console.error(`Failed to process pending ${op.type} operation:`, error);
        failCount++;
      }
    }
    
    if (successCount > 0) {
      showToast(`🔄 ซิงค์ข้อมูลค้างไว้ ${successCount} รายการสำเร็จ`, 'success', 3000);
    }
    if (failCount > 0) {
      showToast(`⚠️ ซิงค์ล้มเหลว ${failCount} รายการ จะลองใหม่ภายหลัง`, 'error', 3000);
    }
  }, [user, showToast]);

  // Load todos on mount - try cloud first if authenticated, fallback to local
  useEffect(() => {
    const loadTodos = async () => {
      const localTodos = await loadTodosFromDB();
      
      if (user) {
        // User is logged in, try to sync with cloud
        setIsSyncing(true);
        try {
          const cloudTodos = await loadTodosFromCloud(user.uid);
          
          // Check if we need to show merge modal
          // Show when: 
          // 1. Has local data
          // 2. AND (never synced with this user OR local has items not in cloud)
          const lastSyncedUser = getLastSyncedUserId();
          const isDifferentUser = lastSyncedUser !== user.uid;
          
          // Check if all local items exist in cloud (by id)
          const cloudTodoIds = new Set(cloudTodos.map(t => t.id));
          const localOnlyTodos = localTodos.filter(t => !cloudTodoIds.has(t.id));
          const hasUnsyncedLocalData = localOnlyTodos.length > 0;
          
          if (localTodos.length > 0 && !hasShownMergeModal.current && (isDifferentUser || hasUnsyncedLocalData)) {
            // Save pending data and show modal
            setPendingLocalTodos(localTodos);
            setPendingCloudTodos(cloudTodos);
            setShowMergeModal(true);
            hasShownMergeModal.current = true;
            setIsSyncing(false);
            setHydrated(true);
            return;
          }
          
          if (cloudTodos.length > 0 && localTodos.length > 0) {
            // Merge local and cloud
            const merged = mergeTodos(localTodos, cloudTodos);
            setTodos(merged);
            // Sync merged data back to cloud
            await saveTodosToCloud(user.uid, merged);
            // Mark as synced with this user
            setLastSyncedUserId(user.uid);
            showToast('🔄 ซิงค์ข้อมูลสำเร็จ', 'success', 2000);
          } else if (cloudTodos.length > 0) {
            setTodos(cloudTodos);
            // Save cloud data to local
            await saveTodosToDB(cloudTodos);
            // Mark as synced with this user
            setLastSyncedUserId(user.uid);
            showToast('☁️ โหลดข้อมูลจาก Cloud สำเร็จ', 'success', 2000);
          } else if (localTodos.length > 0) {
            setTodos(localTodos);
            // Upload local data to cloud
            await saveTodosToCloud(user.uid, localTodos);
            // Mark as synced with this user
            setLastSyncedUserId(user.uid);
            showToast('⬆️ อัพโหลดข้อมูลไป Cloud สำเร็จ', 'success', 2000);
          } else {
            setTodos([]);
            // Mark as synced (empty data)
            setLastSyncedUserId(user.uid);
          }
          
          // Process any pending operations
          await processPendingOperations();
        } catch (error) {
          console.error('Failed to sync with cloud:', error);
          setTodos(localTodos);
          showToast('⚠️ ซิงค์ข้อมูลล้มเหลว ใช้ข้อมูลในเครื่อง', 'error', 3000);
        } finally {
          setIsSyncing(false);
        }
      } else {
        // Not logged in, use local data
        setTodos(localTodos);
      }
      
      setHydrated(true);
    };
    
    if (!authLoading) {
      loadTodos();
    }
  }, [user, authLoading, processPendingOperations]);

  // Save todos to local whenever they change
  useEffect(() => {
    if (!hydrated) return;
    saveTodosToDB(todos);
  }, [hydrated, todos]);

  // Sync to cloud when todos change (if authenticated)
  useEffect(() => {
    if (!hydrated || !user || isSyncing) return;
    
    const syncToCloud = async () => {
      try {
        await saveTodosToCloud(user.uid, todos);
      } catch (error) {
        console.error('Failed to sync to cloud:', error);
      }
    };
    
    // Debounce cloud sync
    const timeoutId = setTimeout(syncToCloud, 1000);
    return () => clearTimeout(timeoutId);
  }, [hydrated, todos, user, isSyncing]);

  // Save dark mode
  useEffect(() => {
    try {
      localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    } catch (error) {
      console.error('Failed to save dark mode to localStorage:', error);
      try {
        sessionStorage.setItem('darkMode', JSON.stringify(isDarkMode));
      } catch (sessionError) {
        console.error('Failed to save dark mode to sessionStorage:', sessionError);
      }
    }
    
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Save user name
  useEffect(() => {
    try {
      localStorage.setItem('userName', userName);
    } catch (error) {
      console.error('Failed to save user name to localStorage:', error);
      try {
        sessionStorage.setItem('userName', userName);
      } catch (sessionError) {
        console.error('Failed to save user name to sessionStorage:', sessionError);
      }
    }
  }, [userName]);

  // Update userName when Google user changes
  useEffect(() => {
    if (user?.displayName && !userName) {
      setUserName(user.displayName);
    }
  }, [user, userName]);

  // Check for 100% completion
  useEffect(() => {
    if (todos.length > 0 && todos.every(t => t.completed)) {
      triggerCelebration();
      showToast('🎉 ยินดีด้วย! คุณทำงานครบทุกรายการแล้ว', 'success', 5000);
    }
  }, [todos, triggerCelebration, showToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addTodo = async (text: string, priority: 'low' | 'medium' | 'high', note?: string) => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      text,
      completed: false,
      createdAt: new Date(),
      priority,
      note
    };
    
    setTodos((prev) => [newTodo, ...prev]);
    
    if (user) {
      try {
        await saveTodoToCloud(user.uid, newTodo);
      } catch (error) {
        console.error('Failed to save todo to cloud:', error);
        // Queue for retry
        await savePendingOperation({ type: 'add', todoId: newTodo.id, todo: newTodo });
        showToast('⚠️ บันทึกในเครื่องแล้ว จะซิงค์เมื่อออนไลน์', 'info', 3000);
      }
    }
    
    showToast('✅ เพิ่มรายการสำเร็จ', 'success', 2000);
  };

  const toggleTodo = useCallback(async (id: string) => {
    setTodos((prev) => {
      const todo = prev.find(t => t.id === id);
      const newCompleted = !todo?.completed;
      
      if (newCompleted && todo?.priority === 'high') {
        triggerSuccess();
        showToast('🎊 เสร็จงานสำคัญแล้ว!', 'success', 3000);
      }
      
      const updatedTodos = prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      );
      
      // Sync individual todo to cloud
      if (user) {
        const updatedTodo = updatedTodos.find(t => t.id === id);
        if (updatedTodo) {
          saveTodoToCloud(user.uid, updatedTodo).catch(async error => {
            console.error('Failed to sync todo to cloud:', error);
            await savePendingOperation({ type: 'update', todoId: id, todo: updatedTodo });
          });
        }
      }
      
      return updatedTodos;
    });
  }, [showToast, triggerSuccess, user]);

  const deleteTodo = useCallback(async (id: string) => {
    // Find todo before deleting
    const todoToDelete = todos.find(t => t.id === id);
    const index = todos.findIndex(t => t.id === id);
    
    // Store in ref before state update
    const deletedTodoData = { todo: todoToDelete!, index };
    deletedTodoRef.current = deletedTodoData;
    
    setTodos((prev) => {
      return prev.filter((todo) => todo.id !== id);
    });
    
    let cloudDeleteSuccess = false;
    
    if (user) {
      try {
        await deleteTodoFromCloud(user.uid, id);
        cloudDeleteSuccess = true;
      } catch (error) {
        console.error('Failed to delete todo from cloud:', error);
        // Queue for retry
        await savePendingOperation({ type: 'delete', todoId: id });
      }
    }
    
    showToast(
      user 
        ? cloudDeleteSuccess 
          ? '🗑️ ลบรายการแล้ว (ซิงค์สำเร็จ)' 
          : '🗑️ ลบรายการแล้ว (จะซิงค์เมื่อออนไลน์)'
        : '🗑️ ลบรายการแล้ว',
      'undo',
      5000,
      async () => {
        // Undo action - use closure to capture the deleted data
        const todoToRestore = deletedTodoData.todo;
        const restoreIndex = deletedTodoData.index;
        
        setTodos((prev) => {
          const newTodos = [...prev];
          newTodos.splice(restoreIndex, 0, todoToRestore);
          return newTodos;
        });
        
        if (user) {
          try {
            await saveTodoToCloud(user.uid, todoToRestore);
            showToast('↩️ กู้คืนรายการแล้ว (ซิงค์สำเร็จ)', 'info', 3000);
          } catch (error) {
            console.error('Failed to restore todo to cloud:', error);
            await savePendingOperation({ type: 'add', todoId: todoToRestore.id, todo: todoToRestore });
            showToast('↩️ กู้คืนรายการแล้ว (จะซิงค์เมื่อออนไลน์)', 'info', 3000);
          }
        } else {
          showToast('↩️ กู้คืนรายการแล้ว', 'info', 3000);
        }
        
        // Clear the ref after undo
        deletedTodoRef.current = null;
      }
    );
  }, [showToast, user, todos]);

  const editTodo = async (id: string, text: string, createdAt: Date, priority: 'low' | 'medium' | 'high', note?: string) => {
    const originalTodo = todos.find(t => t.id === id);
    
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, text, createdAt, priority, note } : todo
      )
    );
    
    if (user) {
      const updatedTodo = { ...originalTodo!, text, createdAt, priority, note };
      try {
        await saveTodoToCloud(user.uid, updatedTodo);
      } catch (error) {
        console.error('Failed to update todo in cloud:', error);
        await savePendingOperation({ type: 'update', todoId: id, todo: updatedTodo });
      }
    }
    
    showToast('✏️ แก้ไขรายการสำเร็จ', 'success', 2000);
  };

  // Handle merge decision - Merge local and cloud data
  const handleMergeData = async () => {
    setShowMergeModal(false);
    setIsSyncing(true);
    
    try {
      const merged = mergeTodos(pendingLocalTodos, pendingCloudTodos);
      setTodos(merged);
      await saveTodosToDB(merged);
      
      if (user) {
        await saveTodosToCloud(user.uid, merged);
        await processPendingOperations();
        // Mark as synced with this user
        setLastSyncedUserId(user.uid);
      }
      
      showToast('🔄 รวมข้อมูลสำเร็จ', 'success', 3000);
    } catch (error) {
      console.error('Failed to merge data:', error);
      showToast('❌ รวมข้อมูลล้มเหลว', 'error', 3000);
      // Fallback to local data
      setTodos(pendingLocalTodos);
    } finally {
      setIsSyncing(false);
      setPendingLocalTodos([]);
      setPendingCloudTodos([]);
    }
  };

  // Handle replace decision - Delete local and use cloud only
  const handleReplaceData = async () => {
    setShowMergeModal(false);
    setIsSyncing(true);
    
    try {
      // Clear local data first
      if (!db) {
        db = await initDB();
      }
      
      const storeNames = Array.from(db!.objectStoreNames);
      const storesToClear = [];
      if (storeNames.includes(STORE_NAME)) {
        storesToClear.push(STORE_NAME);
      }
      if (storeNames.includes('pendingOps')) {
        storesToClear.push('pendingOps');
      }
      
      if (storesToClear.length > 0) {
        const transaction = db!.transaction(storesToClear, 'readwrite');
        for (const storeName of storesToClear) {
          const store = transaction.objectStore(storeName);
          await promisifyRequest(store.clear());
        }
        await waitForTransaction(transaction);
      }
      
      // Use cloud data
      setTodos(pendingCloudTodos);
      await saveTodosToDB(pendingCloudTodos);
      
      // Mark as synced with this user
      if (user) {
        setLastSyncedUserId(user.uid);
      }
      
      if (pendingCloudTodos.length > 0) {
        showToast('☁️ ใช้ข้อมูลจาก Cloud แทนข้อมูลเดิม', 'info', 3000);
      } else {
        showToast('🗑️ ลบข้อมูลเดิมแล้ว (ไม่มีข้อมูลบน Cloud)', 'info', 3000);
      }
    } catch (error) {
      console.error('Failed to replace data:', error);
      showToast('❌ ไม่สามารถลบข้อมูลเดิมได้', 'error', 3000);
      // Fallback to local data
      setTodos(pendingLocalTodos);
    } finally {
      setIsSyncing(false);
      setPendingLocalTodos([]);
      setPendingCloudTodos([]);
    }
  };

  // Handle cancel - Keep local data only
  const handleCancelMerge = () => {
    setShowMergeModal(false);
    setTodos(pendingLocalTodos);
    setPendingLocalTodos([]);
    setPendingCloudTodos([]);
    showToast('⚠️ ใช้ข้อมูลในเครื่องต่อ (ยังไม่ซิงค์)', 'info', 3000);
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      showToast('👋 เข้าสู่ระบบสำเร็จ', 'success', 3000);
    } catch (error) {
      console.error('Sign in error:', error);
      showToast('❌ เข้าสู่ระบบล้มเหลว', 'error', 3000);
    }
  };

  // Show logout confirm modal
  const handleShowLogoutConfirm = () => {
    setShowLogoutConfirm(true);
  };

  // Handle logout with keeping data
  const handleLogoutKeepData = async () => {
    setShowLogoutConfirm(false);
    try {
      await logout();
      hasShownMergeModal.current = false; // Reset for next login
      // Note: We keep lastSyncedUserId so we know which user was last synced
      showToast('👋 ออกจากระบบสำเร็จ (เก็บข้อมูลไว้)', 'info', 3000);
    } catch (error) {
      console.error('Logout error:', error);
      showToast('❌ ออกจากระบบล้มเหลว', 'error', 3000);
    }
  };

  // Handle logout with clearing data
  const handleLogoutClearData = async () => {
    setShowLogoutConfirm(false);
    
    // Clear local data first
    try {
      if (!db) {
        db = await initDB();
      }
      
      const storeNames = Array.from(db!.objectStoreNames);
      const storesToClear = [];
      if (storeNames.includes(STORE_NAME)) {
        storesToClear.push(STORE_NAME);
      }
      if (storeNames.includes('pendingOps')) {
        storesToClear.push('pendingOps');
      }
      
      if (storesToClear.length > 0) {
        const transaction = db!.transaction(storesToClear, 'readwrite');
        for (const storeName of storesToClear) {
          const store = transaction.objectStore(storeName);
          await promisifyRequest(store.clear());
        }
        await waitForTransaction(transaction);
      }
      
      // Clear state
      setTodos([]);
      
      // Then logout
      await logout();
      hasShownMergeModal.current = false;
      setLastSyncedUserId(null);
      
      showToast('🗑️ ลบข้อมูลและออกจากระบบสำเร็จ', 'info', 3000);
    } catch (error) {
      console.error('Failed to clear data and logout:', error);
      showToast('⚠️ ลบข้อมูลไม่สำเร็จ แต่ออกจากระบบแล้ว', 'error', 3000);
      await logout();
    }
  };

  // Handle cancel logout
  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const exportTodosAsCSV = () => {
    if (todos.length === 0) {
      showToast('⚠️ ไม่มีรายการให้ส่งออก', 'error', 3000);
      return;
    }
    
    const rows = todos.map((todo) => [
      escapeCSV(todo.id),
      escapeCSV(todo.text),
      escapeCSV(String(todo.completed)),
      escapeCSV(todo.createdAt.toISOString()),
      escapeCSV(todo.priority),
      escapeCSV(todo.note || ''),
    ]);

    const csv = [csvHeaders.join(','), ...rows.map((row) => row.join(','))].join('\n');

    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `todolist-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('📤 ส่งออก CSV สำเร็จ', 'success', 3000);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      showToast('❌ ส่งออก CSV ล้มเหลว', 'error', 3000);
    }
  };

  const importTodosFromCSV = (file: File) => {
    const readFile = (targetFile: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(targetFile, 'utf-8');
      });

    readFile(file)
      .then(async (text) => {
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length === 0) {
          showToast('⚠️ ไฟล์ CSV ว่างเปล่า', 'error', 3000);
          return;
        }

        const headerLine = lines.shift()!;
        splitCSVLine(headerLine);

        const parsedTodos: Todo[] = lines.map((line) => {
          const values = splitCSVLine(line);
          const [id, textValue, completedValue, createdAtValue, priorityValue, noteValue] = values;

          return {
            id: id || Date.now().toString(),
            text: textValue || '',
            completed: completedValue === 'true',
            createdAt: createdAtValue ? new Date(createdAtValue) : new Date(),
            priority: (priorityValue as Todo['priority']) || 'medium',
            note: noteValue || undefined,
          };
        });

        setTodos(parsedTodos);
        
        if (user) {
          try {
            await saveTodosToCloud(user.uid, parsedTodos);
          } catch (error) {
            console.error('Failed to sync imported todos:', error);
            // Queue all for retry
            for (const todo of parsedTodos) {
              await savePendingOperation({ type: 'add', todoId: todo.id, todo });
            }
          }
        }
        
        showToast('📥 นำเข้าข้อมูลสำเร็จ', 'success', 3000);
      })
      .catch((error) => {
        console.error('Failed to import CSV:', error);
        showToast('❌ นำเข้าข้อมูลล้มเหลว', 'error', 3000);
      });
  };

  const exportTodosAsExcelHandler = async (todosToExport: Todo[], monthLabel?: string, userNameForExport?: string) => {
    try {
      const nameToUse = userNameForExport !== undefined ? userNameForExport : userName;
      await exportTodosAsExcel(todosToExport, monthLabel, nameToUse);
      showToast('📊 ส่งออก Excel สำเร็จ', 'success', 3000);
    } catch (error) {
      console.error('Failed to export Excel:', error);
      showToast('❌ ส่งออก Excel ล้มเหลว', 'error', 3000);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  if (authLoading) {
    return (
      <div className="app-shell">
        <div className="app-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Data Merge Modal */}
      <DataMergeModal
        isOpen={showMergeModal}
        localCount={pendingLocalTodos.length}
        cloudCount={pendingCloudTodos.length}
        user={user}
        onMerge={handleMergeData}
        onReplace={handleReplaceData}
        onCancel={handleCancelMerge}
      />
      
      {/* Logout Confirm Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        user={user}
        localDataCount={todos.length}
        onKeepData={handleLogoutKeepData}
        onDeleteData={handleLogoutClearData}
        onCancel={handleCancelLogout}
      />
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            importTodosFromCSV(file);
            event.target.value = '';
          }
        }}
      />
      
      <TodoList
        todos={todos}
        filter={filter}
        isDarkMode={isDarkMode}
        userName={userName}
        isAuthenticated={isAuthenticated}
        user={user}
        isSyncing={isSyncing}
        onAddTodo={addTodo}
        onToggleTodo={toggleTodo}
        onDeleteTodo={deleteTodo}
        onEditTodo={editTodo}
        onExportCSV={exportTodosAsCSV}
        onImportCSV={handleImportClick}
        onExportExcel={exportTodosAsExcelHandler}
        onFilterChange={setFilter}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onUserNameChange={setUserName}
        onSignIn={handleSignIn}
        onLogout={handleLogoutKeepData}
        onShowLogoutConfirm={handleShowLogoutConfirm}
      />
      
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        todos={todos}
        filter={filter}
        isDarkMode={isDarkMode}
        userName={userName}
        onFilterChange={setFilter}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onToggleTodo={toggleTodo}
        onExportCSV={exportTodosAsCSV}
        onImportCSV={handleImportClick}
        onExportExcel={exportTodosAsExcelHandler}
        onAddTodo={() => {
          const textarea = document.querySelector('.form-card textarea') as HTMLTextAreaElement;
          if (textarea) {
            textarea.focus();
          }
        }}
      />
    </>
  );
}

export default App;
