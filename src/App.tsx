import { useState, useEffect } from 'react';
import type { Todo, TodoFilter } from './utils/todoTypes';
import TodoList from './components/TodoList';

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

const csvHeaders = ['id', 'text', 'completed', 'createdAt', 'priority'] as const;

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
  const [hydrated, setHydrated] = useState(false);

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
      console.log('Dark mode saved to localStorage');
    } catch (error) {
      console.error('Failed to save dark mode to localStorage:', error);
      // Fallback to sessionStorage
      try {
        sessionStorage.setItem('darkMode', JSON.stringify(isDarkMode));
        console.log('Dark mode saved to sessionStorage as fallback');
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

  const addTodo = (text: string, priority: 'low' | 'medium' | 'high') => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      text,
      completed: false,
      createdAt: new Date(),
      priority
    };
    setTodos((prev) => [newTodo, ...prev]);
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const editTodo = (id: string, text: string, createdAt: Date, priority: 'low' | 'medium' | 'high') => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, text, createdAt, priority } : todo
      )
    );
  };

  const exportTodosAsCSV = () => {
    if (todos.length === 0) {
      console.warn('No todos to export');
      return;
    }
    const rows = todos.map((todo) => [
      escapeCSV(todo.id),
      escapeCSV(todo.text),
      escapeCSV(String(todo.completed)),
      escapeCSV(todo.createdAt.toISOString()),
      escapeCSV(todo.priority),
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
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  const importTodosFromCSV = async (file: File) => {
    const readFile = (targetFile: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(targetFile, 'utf-8');
      });

    try {
      const text = await readFile(file);
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        console.warn('CSV file is empty');
        return;
      }

      const headerLine = lines.shift()!;
      const headers = splitCSVLine(headerLine);
      const expected = csvHeaders.join(',');
      if (headers.join(',') !== expected) {
        console.warn('CSV header mismatch. Expected:', expected, 'got:', headers.join(','));
      }

      const parsedTodos: Todo[] = lines.map((line) => {
        const values = splitCSVLine(line);
        const [id, textValue, completedValue, createdAtValue, priorityValue] = values;

        return {
          id: id || Date.now().toString(),
          text: textValue || '',
          completed: completedValue === 'true',
          createdAt: createdAtValue ? new Date(createdAtValue) : new Date(),
          priority: (priorityValue as Todo['priority']) || 'medium',
        };
      });

      setTodos(parsedTodos);
    } catch (error) {
      console.error('Failed to import CSV:', error);
    }
  };

  return (
    <TodoList
      todos={todos}
      filter={filter}
      isDarkMode={isDarkMode}
      onAddTodo={addTodo}
      onToggleTodo={toggleTodo}
      onDeleteTodo={deleteTodo}
      onEditTodo={editTodo}
      onExportCSV={exportTodosAsCSV}
      onImportCSV={importTodosFromCSV}
      onFilterChange={setFilter}
      onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
    />
  );
}

export default App;
