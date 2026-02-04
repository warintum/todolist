import { useState, useEffect, useRef, useCallback } from 'react';
import type { Todo, TodoFilter } from './utils/todoTypes';
import TodoList from './components/TodoList';
import { exportTodosAsExcel } from './utils/excelExport';
import { useToast } from './contexts/ToastContext';
import { CommandPalette } from './components/CommandPalette';
import { useConfetti } from './hooks/useConfetti';

// IndexedDB implementation
const DB_NAME = 'TodoListDB';
const DB_VERSION = 1;
const STORE_NAME = 'todos';

let db: IDBDatabase | null = null;

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
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
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

    // Clear existing todos
    await promisifyRequest(store.clear());

    // Upsert all todos
    for (const todo of todos) {
      await promisifyRequest(store.put(todo));
    }

    await waitForTransaction(transaction);
  } catch (error) {
    console.error('Failed to save to IndexedDB:', error);
    // Fallback to sessionStorage
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
    
    // Fallback to sessionStorage
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
  const { showToast } = useToast();
  const { triggerSuccess, triggerCelebration } = useConfetti();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Store deleted todo for undo
  const deletedTodoRef = useRef<{ todo: Todo; index: number } | null>(null);

  // Load todos on mount
  useEffect(() => {
    const loadTodos = async () => {
      const loadedTodos = await loadTodosFromDB();
      setTodos(loadedTodos);
      setHydrated(true);
    };
    
    loadTodos();
  }, []);

  // Save todos whenever they change
  useEffect(() => {
    if (!hydrated) return;
    saveTodosToDB(todos);
  }, [hydrated, todos]);

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
      // Command Palette: Ctrl/Cmd + K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addTodo = (text: string, priority: 'low' | 'medium' | 'high', note?: string) => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      text,
      completed: false,
      createdAt: new Date(),
      priority,
      note
    };
    setTodos((prev) => [newTodo, ...prev]);
    showToast('✅ เพิ่มรายการสำเร็จ', 'success', 2000);
  };

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const todo = prev.find(t => t.id === id);
      const newCompleted = !todo?.completed;
      
      if (newCompleted && todo?.priority === 'high') {
        triggerSuccess();
        showToast('🎊 เสร็จงานสำคัญแล้ว!', 'success', 3000);
      }
      
      return prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      );
    });
  }, [showToast, triggerSuccess]);

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const index = prev.findIndex(t => t.id === id);
      const todo = prev[index];
      deletedTodoRef.current = { todo, index };
      return prev.filter((todo) => todo.id !== id);
    });
    
    showToast('🗑️ ลบรายการแล้ว', 'undo', 5000, () => {
      // Undo action
      if (deletedTodoRef.current) {
        setTodos((prev) => {
          const { todo, index } = deletedTodoRef.current!;
          const newTodos = [...prev];
          newTodos.splice(index, 0, todo);
          return newTodos;
        });
        showToast('↩️ กู้คืนรายการแล้ว', 'info', 2000);
      }
    });
  }, [showToast]);

  const editTodo = (id: string, text: string, createdAt: Date, priority: 'low' | 'medium' | 'high', note?: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, text, createdAt, priority, note } : todo
      )
    );
    showToast('✏️ แก้ไขรายการสำเร็จ', 'success', 2000);
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
      .then((text) => {
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length === 0) {
          showToast('⚠️ ไฟล์ CSV ว่างเปล่า', 'error', 3000);
          return;
        }

        const headerLine = lines.shift()!;
        // Skip header validation for now
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
        showToast('📥 นำเข้าข้อมูลสำเร็จ', 'success', 3000);
      })
      .catch((error) => {
        console.error('Failed to import CSV:', error);
        showToast('❌ นำเข้าข้อมูลล้มเหลว', 'error', 3000);
      });
  };

  const exportTodosAsExcelHandler = async (todosToExport: Todo[], monthLabel?: string, userNameForExport?: string) => {
    try {
      // Use the provided userNameForExport if available, otherwise fall back to state
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

  return (
    <>
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
          // Focus on the add todo textarea
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
