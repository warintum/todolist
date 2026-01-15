import { useState, useRef, type FormEvent } from 'react';
import type { Todo, TodoFilter } from '../utils/todoTypes';
import { cn } from '../utils/cn';
import { Plus, Filter, Moon, Sun } from 'lucide-react';
import TodoItem from './TodoItem';

interface TodoListProps {
  todos: Todo[];
  filter: TodoFilter;
  isDarkMode: boolean;
  onAddTodo: (text: string, priority: 'low' | 'medium' | 'high') => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (id: string, text: string, createdAt: Date, priority: 'low' | 'medium' | 'high') => void;
  onExportCSV: () => void;
  onImportCSV: (file: File) => void;
  onFilterChange: (filter: TodoFilter) => void;
  onToggleDarkMode: () => void;
}

const TodoList = ({
  todos,
  filter,
  isDarkMode,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onEditTodo,
  onExportCSV,
  onImportCSV,
  onFilterChange,
  onToggleDarkMode,
}: TodoListProps) => {
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monthOptions = todos
    .map((todo) => {
      const date = new Date(todo.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const label = date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
      return { key, label, timestamp: date.getTime() };
    })
    .filter((option, index, self) => index === self.findIndex((o) => o.key === option.key))
    .sort((a, b) => b.timestamp - a.timestamp);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      onAddTodo(newTodoText.trim(), newTodoPriority);
      setNewTodoText('');
      setNewTodoPriority('medium');
    }
  };

  const filteredTodos = todos.filter(todo => {
    const matchesStatus = filter === 'active' ? !todo.completed : filter === 'completed' ? todo.completed : true;
    const todoMonth = (() => {
      const date = new Date(todo.createdAt);
      return `${date.getFullYear()}-${date.getMonth()}`;
    })();
    const matchesMonth = selectedMonth === 'all' ? true : todoMonth === selectedMonth;
    return matchesStatus && matchesMonth;
  });

  const activeTodoCount = todos.filter(todo => !todo.completed).length;
  const completedTodoCount = todos.filter(todo => todo.completed).length;

  return (
    <div className="app-shell">
      <div className="app-panel">
        <div className="header-row">
          <h1 className="title">รายการงานของฉัน</h1>
          <div className="header-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onImportCSV(file);
                  event.target.value = '';
                }
              }}
            />
            <button type="button" className="icon-button" onClick={() => fileInputRef.current?.click()}>
              นำเข้า CSV
            </button>
            <button type="button" className="icon-button" onClick={onExportCSV}>
              ส่งออก CSV
            </button>
            <button onClick={onToggleDarkMode} className="icon-button" aria-label="toggle theme">
              {isDarkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="card stat-card tint-blue">
            <div className="stat-number blue">{todos.length}</div>
            <div className="stat-label">ทั้งหมด</div>
          </div>
          <div className="card stat-card tint-orange">
            <div className="stat-number orange">{activeTodoCount}</div>
            <div className="stat-label">กำลังทำ</div>
          </div>
          <div className="card stat-card tint-green">
            <div className="stat-number green">{completedTodoCount}</div>
            <div className="stat-label">เสร็จแล้ว</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card form-card">
            <div className="form-row">
              <input
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="เพิ่มรายการงานใหม่..."
                className="input"
              />
              <select
                value={newTodoPriority}
                onChange={(e) => setNewTodoPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="select"
              >
                <option value="low">ต่ำ</option>
                <option value="medium">ปานกลาง</option>
                <option value="high">สูง</option>
              </select>
              <button type="submit" className="primary-button">
                <Plus className="w-4 h-4" />
                เพิ่ม
              </button>
            </div>
          </div>
        </form>

        <div className="card segmented-row">
          <div className="segmented">
            {(['all', 'active', 'completed'] as TodoFilter[]).map((filterType) => (
              <button
                key={filterType}
                type="button"
                onClick={() => onFilterChange(filterType)}
                className={cn('segmented-btn', filter === filterType && 'active')}
              >
                <Filter className="w-4 h-4" />
                {filterType === 'all' ? 'ทั้งหมด' : filterType === 'active' ? 'กำลังทำ' : 'เสร็จแล้ว'}
              </button>
            ))}            
          <select
            className="select month-select"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          >
            <option value="all">ทุกเดือน</option>
            {monthOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          </div>
        </div>

        <div className="list">
          {filteredTodos.length === 0 ? (
            <div className="card empty">
              {filter === 'all' && 'ยังไม่มีรายการงาน'}
              {filter === 'active' && 'ไม่มีรายการงานที่กำลังทำ'}
              {filter === 'completed' && 'ยังไม่มีรายการงานที่เสร็จแล้ว'}
            </div>
          ) : (
            filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={onToggleTodo}
                onDelete={onDeleteTodo}
                onEdit={onEditTodo}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TodoList;
