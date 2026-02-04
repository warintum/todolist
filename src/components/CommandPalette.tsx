import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  CheckCircle2, 
  Circle, 
  ListTodo, 
  Sun, 
  Moon, 
  Download, 
  Upload,
  FileSpreadsheet,
  X
} from 'lucide-react';
import type { Todo, TodoFilter } from '../utils/todoTypes';
import { cn } from '../utils/cn';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  todos: Todo[];
  filter: TodoFilter;
  isDarkMode: boolean;
  onFilterChange: (filter: TodoFilter) => void;
  onToggleDarkMode: () => void;
  onToggleTodo: (id: string) => void;
  onExportCSV: () => void;
  onImportCSV: () => void;
  onExportExcel: () => void;
  onAddTodo: () => void;
}

interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette = ({
  isOpen,
  onClose,
  todos,
  filter,
  isDarkMode,
  onFilterChange,
  onToggleDarkMode,
  onToggleTodo,
  onExportCSV,
  onImportCSV,
  onExportExcel,
  onAddTodo,
}: CommandPaletteProps) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) {
        // Open with Ctrl/Cmd + K
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          onClose(); // This will toggle since isOpen is false
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => 
            prev < filteredCommands.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedIndex]);

  // Build commands list
  const commands: Command[] = useMemo(() => {
    const list: Command[] = [
      {
        id: 'add',
        title: 'เพิ่มรายการใหม่',
        subtitle: 'สร้างงานใหม่',
        icon: <ListTodo className="w-5 h-5" />,
        shortcut: 'Ctrl+N',
        action: () => {
          onAddTodo();
        },
      },
      {
        id: 'filter-all',
        title: 'แสดงทั้งหมด',
        subtitle: filter === 'all' ? 'กำลังใช้งาน' : undefined,
        icon: <ListTodo className="w-5 h-5" />,
        action: () => onFilterChange('all'),
      },
      {
        id: 'filter-active',
        title: 'แสดงงานที่กำลังทำ',
        subtitle: filter === 'active' ? 'กำลังใช้งาน' : undefined,
        icon: <Circle className="w-5 h-5" />,
        action: () => onFilterChange('active'),
      },
      {
        id: 'filter-completed',
        title: 'แสดงงานที่เสร็จแล้ว',
        subtitle: filter === 'completed' ? 'กำลังใช้งาน' : undefined,
        icon: <CheckCircle2 className="w-5 h-5" />,
        action: () => onFilterChange('completed'),
      },
      {
        id: 'theme',
        title: isDarkMode ? 'เปลี่ยนเป็นโหมดกลางวัน' : 'เปลี่ยนเป็นโหมดกลางคืน',
        icon: isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />,
        shortcut: 'Ctrl+T',
        action: onToggleDarkMode,
      },
      {
        id: 'export-csv',
        title: 'ส่งออก CSV',
        icon: <Upload className="w-5 h-5" />,
        action: () => {
          onExportCSV();
        },
      },
      {
        id: 'export-excel',
        title: 'ส่งออก Excel',
        icon: <FileSpreadsheet className="w-5 h-5" />,
        action: () => {
          onExportExcel();
        },
      },
      {
        id: 'import-csv',
        title: 'นำเข้า CSV',
        icon: <Download className="w-5 h-5" />,
        action: () => {
          onImportCSV();
        },
      },
    ];

    // Add todo items as searchable commands
    const todoCommands: Command[] = todos.map((todo) => ({
      id: todo.id,
      title: todo.text,
      subtitle: todo.completed ? 'เสร็จแล้ว' : 'กำลังทำ',
      icon: todo.completed 
        ? <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--success-500)' }} />
        : <Circle className="w-5 h-5" style={{ color: 'var(--warning-500)' }} />,
      action: () => onToggleTodo(todo.id),
    }));

    return [...list, ...todoCommands];
  }, [todos, filter, isDarkMode, onFilterChange, onToggleDarkMode, onToggleTodo, onExportCSV, onImportCSV, onExportExcel, onAddTodo]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    const query = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(query) ||
        cmd.subtitle?.toLowerCase().includes(query)
    );
  }, [commands, search]);

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  return (
    <div className="command-overlay" onClick={onClose}>
      <div 
        className="command-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-header">
          <Search className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาคำสั่งหรือรายการ..."
            className="command-input"
          />
          <button 
            onClick={onClose}
            className="command-close-btn"
            aria-label="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="command-list">
          {filteredCommands.length === 0 ? (
            <div className="command-empty">
              ไม่พบคำสั่งหรือรายการที่ค้นหา
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                className={cn('command-item', index === selectedIndex && 'selected')}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="command-item-icon">{cmd.icon}</div>
                <div className="command-item-content">
                  <div className="command-item-title">{cmd.title}</div>
                  {cmd.subtitle && (
                    <div className="command-item-subtitle">{cmd.subtitle}</div>
                  )}
                </div>
                {cmd.shortcut && (
                  <kbd className="command-shortcut">{cmd.shortcut}</kbd>
                )}
              </button>
            ))
          )}
        </div>

        <div className="command-footer">
          <div className="command-hint">
            <kbd>↑↓</kbd> เลือก <kbd>Enter</kbd> ยืนยัน <kbd>ESC</kbd> ปิด
          </div>
          <div className="command-hint-shortcut">
            กด <kbd>Ctrl</kbd> + <kbd>K</kbd> เพื่อเปิด
          </div>
        </div>
      </div>
    </div>
  );
};
