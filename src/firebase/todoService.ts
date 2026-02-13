import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  orderBy,
  writeBatch,
  serverTimestamp,
  type Timestamp 
} from 'firebase/firestore';
import { db } from './config';
import type { Todo } from '../utils/todoTypes';

// Helper to get user todos collection reference
const getUserTodosRef = (userId: string) => {
  return collection(db, 'users', userId, 'todos');
};

// Convert Firestore timestamp to Date
const convertTimestamp = (timestamp: Timestamp | Date | undefined): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  // Firestore Timestamp
  return timestamp.toDate();
};

// Save all todos to Firestore (used for initial sync or bulk update)
export const saveTodosToCloud = async (userId: string, todos: Todo[]): Promise<void> => {
  const todosRef = getUserTodosRef(userId);
  const batch = writeBatch(db);

  // Delete all existing todos first
  const existingSnapshot = await getDocs(todosRef);
  existingSnapshot.docs.forEach((docSnapshot) => {
    batch.delete(docSnapshot.ref);
  });

  // Add all current todos
  todos.forEach((todo) => {
    const todoDocRef = doc(todosRef, todo.id);
    batch.set(todoDocRef, {
      text: todo.text,
      completed: todo.completed,
      createdAt: todo.createdAt,
      priority: todo.priority,
      note: todo.note || null,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
};

// Add or update a single todo
export const saveTodoToCloud = async (userId: string, todo: Todo): Promise<void> => {
  const todoDocRef = doc(db, 'users', userId, 'todos', todo.id);
  await setDoc(todoDocRef, {
    text: todo.text,
    completed: todo.completed,
    createdAt: todo.createdAt,
    priority: todo.priority,
    note: todo.note || null,
    updatedAt: serverTimestamp(),
  });
};

// Delete a todo from cloud
export const deleteTodoFromCloud = async (userId: string, todoId: string): Promise<void> => {
  const todoDocRef = doc(db, 'users', userId, 'todos', todoId);
  await deleteDoc(todoDocRef);
};

// Load all todos from Firestore
export const loadTodosFromCloud = async (userId: string): Promise<Todo[]> => {
  const todosRef = getUserTodosRef(userId);
  const q = query(todosRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((docSnapshot) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      text: data.text,
      completed: data.completed,
      createdAt: convertTimestamp(data.createdAt),
      priority: data.priority,
      note: data.note || undefined,
    } as Todo;
  });
};

// Merge local and cloud todos (in case of conflicts)
export const mergeTodos = (localTodos: Todo[], cloudTodos: Todo[]): Todo[] => {
  const todoMap = new Map<string, Todo>();
  
  // Add all local todos
  localTodos.forEach(todo => {
    todoMap.set(todo.id, todo);
  });
  
  // Add/merge cloud todos
  cloudTodos.forEach(cloudTodo => {
    const localTodo = todoMap.get(cloudTodo.id);
    if (!localTodo) {
      // Cloud todo doesn't exist locally, add it
      todoMap.set(cloudTodo.id, cloudTodo);
    }
    // If exists in both, keep local version (local is more recent)
  });
  
  // Convert back to array and sort by createdAt desc
  return Array.from(todoMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};
