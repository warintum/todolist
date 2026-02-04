import { useState, useRef, type FormEvent, useCallback } from 'react';
import type { Todo, TodoFilter } from '../utils/todoTypes';
import { cn } from '../utils/cn';
import { Plus, Filter, Moon, Sun, Download, Upload, FileSpreadsheet } from 'lucide-react';
import TodoItem from './TodoItem';

interface TodoListProps {
  todos: Todo[];
  filter: TodoFilter;
  isDarkMode: boolean;
  userName: string;
  onAddTodo: (text: string, priority: 'low' | 'medium' | 'high', note?: string) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (id: string, text: string, createdAt: Date, priority: 'low' | 'medium' | 'high', note?: string) => void;
  onExportCSV: () => void;
  onImportCSV: (file: File) => void;
  onExportExcel: (monthLabel?: string) => Promise<void>;
  onFilterChange: (filter: TodoFilter) => void;
  onToggleDarkMode: () => void;
  onUserNameChange: (name: string) => void;
}

const TodoList = ({
  todos,
  filter,
  isDarkMode,
  userName,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onEditTodo,
  onExportCSV,
  onImportCSV,
  onExportExcel,
  onFilterChange,
  onToggleDarkMode,
  onUserNameChange,
}: TodoListProps) => {
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTodoNote, setNewTodoNote] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResizeTextarea = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, 200) + 'px';
  }, []);

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
      onAddTodo(newTodoText.trim(), newTodoPriority, newTodoNote.trim() || undefined);
      setNewTodoText('');
      setNewTodoPriority('medium');
      setNewTodoNote('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewTodoText(e.target.value);
    autoResizeTextarea(e.target);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (newTodoText.trim()) {
        handleSubmit(e as unknown as FormEvent);
      }
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
        {/* Header */}
        <div className="header-row">
          <h1 className="title">To Do List</h1>
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
            <button type="button" className="icon-button" onClick={() => fileInputRef.current?.click()} title="นำเข้า CSV">
              <Download className="w-4 h-4" />
            </button>
            <button type="button" className="icon-button" onClick={onExportCSV} title="ส่งออก CSV">
              <Upload className="w-4 h-4" />
            </button>
            <button type="button" className="icon-button" onClick={async () => {
              const monthLabel = selectedMonth === 'all' 
                ? undefined 
                : monthOptions.find(o => o.key === selectedMonth)?.label;
              await onExportExcel(monthLabel);
            }} title="ส่งออก Excel">
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button onClick={onToggleDarkMode} className="icon-button" aria-label="toggle theme" title={isDarkMode ? "โหมดกลางวัน" : "โหมดกลางคืน"}>
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* User Name Card */}
        <div className="card form-card">
          <div className="user-input-row">
            <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
              ชื่อผู้ใช้งาน:
            </span>
            <input
              type="text"
              value={userName}
              onChange={(e) => onUserNameChange(e.target.value)}
              placeholder="กรอกชื่อ - นามสกุล..."
              className="input"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="card stat-card total">
            <div className="stat-number">{todos.length}</div>
            <div className="stat-label">ทั้งหมด</div>
          </div>
          <div className="card stat-card active">
            <div className="stat-number warning">{activeTodoCount}</div>
            <div className="stat-label">กำลังทำ</div>
          </div>
          <div className="card stat-card completed">
            <div className="stat-number success">{completedTodoCount}</div>
            <div className="stat-label">เสร็จแล้ว</div>
          </div>
        </div>

        {/* Add Todo Form - Multi-line Textarea */}
        <form onSubmit={handleSubmit}>
          <div className="card form-card">
            <div className="form-row">
              <div style={{ flex: 2, minWidth: 0 }}>
                <textarea
                  ref={textareaRef}
                  value={newTodoText}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="เพิ่มรายการงานใหม่... (กด Ctrl+Enter เพื่อบันทึก)"
                  className="textarea"
                  rows={1}
                />
              </div>
              <select
                value={newTodoPriority}
                onChange={(e) => setNewTodoPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="select"
                style={{ flexShrink: 0 }}
              >
                <option value="low">ต่ำ</option>
                <option value="medium">ปานกลาง</option>
                <option value="high">สูง</option>
              </select>
            </div>
            <div style={{ marginTop: 12 }}>
              <textarea
                value={newTodoNote}
                onChange={(e) => setNewTodoNote(e.target.value)}
                placeholder="หมายเหตุ (ไม่บังคับ)..."
                className="textarea textarea-sm"
                rows={1}
              />
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="primary-button">
                <Plus className="w-4 h-4" />
                เพิ่มรายการ
              </button>
            </div>
          </div>
        </form>

        {/* Filter & Month Select */}
        <div className="card segmented-row">
          <div className="segmented">
            {(['all', 'active', 'completed'] as TodoFilter[]).map((filterType) => (
              <button
                key={filterType}
                type="button"
                onClick={() => onFilterChange(filterType)}
                className={cn('segmented-btn', filter === filterType && 'active')}
                aria-label={filterType === 'all' ? 'ทั้งหมด' : filterType === 'active' ? 'กำลังทำ' : 'เสร็จแล้ว'}
              >
                <Filter className="w-4 h-4" />
                <span className="filter-text-full">
                  {filterType === 'all' ? 'ทั้งหมด' : filterType === 'active' ? 'กำลังทำ' : 'เสร็จแล้ว'}
                </span>
                <span className="filter-text-short">
                  {filterType === 'all' ? 'ทั้งหมด' : filterType === 'active' ? 'ทำ' : 'เสร็จ'}
                </span>
              </button>
            ))}
          </div>
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

        {/* Todo List */}
        <div className="list">
          {filteredTodos.length === 0 ? (
            <div className="card empty">
              {filter === 'all' && 'ยังไม่มีรายการงาน'}
              {filter === 'active' && 'ไม่มีรายการงานที่กำลังทำ'}
              {filter === 'completed' && 'ยังไม่มีรายการงานที่เสร็จแล้ว'}
            </div>
          ) : (
            filteredTodos.map((todo, index) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                index={index}
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
