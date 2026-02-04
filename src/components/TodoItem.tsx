import { useState, useRef, useCallback, useEffect } from 'react';
import type { Todo } from '../utils/todoTypes';
import { cn } from '../utils/cn';
import { Check, Trash2, Edit2, X, Calendar } from 'lucide-react';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string, createdAt: Date, priority: 'low' | 'medium' | 'high', note?: string) => void;
}

const TodoItem = ({ todo, onToggle, onDelete, onEdit }: TodoItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [editDate, setEditDate] = useState(
    new Date(todo.createdAt).toISOString().split('T')[0]
  );
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>(todo.priority);
  const [editNote, setEditNote] = useState(todo.note || '');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResizeTextarea = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, 200) + 'px';
  }, []);

  // Auto-resize when entering edit mode
  useEffect(() => {
    if (isEditing) {
      autoResizeTextarea(textareaRef.current);
      autoResizeTextarea(noteTextareaRef.current);
    }
  }, [isEditing, autoResizeTextarea]);

  const handleSave = () => {
    if (editText.trim()) {
      onEdit(todo.id, editText.trim(), new Date(editDate), editPriority, editNote.trim() || undefined);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditText(todo.text);
    setEditDate(new Date(todo.createdAt).toISOString().split('T')[0]);
    setEditPriority(todo.priority);
    setEditNote(todo.note || '');
    setIsEditing(false);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value);
    autoResizeTextarea(e.target);
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditNote(e.target.value);
    autoResizeTextarea(e.target);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Save on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    // Cancel on Escape
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const createdAtLabel = new Date(todo.createdAt).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
  });

  const fullDateLabel = new Date(todo.createdAt).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="card todo-item">
      {/* Checkbox */}
      <button
        onClick={() => onToggle(todo.id)}
        className={cn('todo-checkbox', todo.completed && 'checked')}
        aria-label={todo.completed ? 'mark as incomplete' : 'mark as complete'}
        type="button"
      >
        {todo.completed && <Check className="w-4 h-4" strokeWidth={3} />}
      </button>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="edit-row">
            {/* Main task textarea */}
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              className="textarea"
              autoFocus
              placeholder="แก้ไขข้อความ..."
              rows={1}
            />
            
            {/* Secondary row: Date, Priority, Note */}
            <div className="edit-row-secondary">
              <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                <Calendar className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="input"
                  aria-label="เลือกวันที่"
                  style={{ minWidth: 140 }}
                />
              </div>
              
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="select"
                aria-label="เลือกความสำคัญ"
                style={{ flexShrink: 0 }}
              >
                <option value="low">ต่ำ</option>
                <option value="medium">ปานกลาง</option>
                <option value="high">สูง</option>
              </select>
              
              <textarea
                ref={noteTextareaRef}
                value={editNote}
                onChange={handleNoteChange}
                onKeyDown={handleKeyDown}
                placeholder="หมายเหตุ..."
                className="textarea textarea-sm"
                rows={1}
                style={{ flex: 2, minWidth: 150 }}
              />
            </div>
            
            {/* Actions */}
            <div className="edit-actions">
              <button
                onClick={handleSave}
                className="icon-btn"
                type="button"
                title="บันทึก (Ctrl+Enter)"
                aria-label="บันทึก"
                style={{ 
                  background: 'rgba(16, 185, 129, 0.1)', 
                  borderColor: 'var(--success-500)',
                  color: 'var(--success-600)'
                }}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancel}
                className="icon-btn"
                type="button"
                title="ยกเลิก (Esc)"
                aria-label="ยกเลิก"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div 
            className="todo-content" 
            onClick={() => setIsEditing(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsEditing(true);
              }
            }}
            aria-label="คลิกเพื่อแก้ไข"
            title={fullDateLabel}
          >
            <span
              className={cn(
                'todo-text',
                todo.completed && 'completed'
              )}
            >
              {todo.text}
            </span>
            
            {/* Show note if exists */}
            {todo.note && (
              <div className="todo-note">
                {todo.note}
              </div>
            )}
            
            <span className="todo-date">{createdAtLabel}</span>
          </div>
        )}
      </div>
      
      {/* Right side: Badge & Actions */}
      <div className="flex items-center gap-2 flex-shrink-0" style={{ marginTop: isEditing ? 0 : 2 }}>
        <span className={cn(
          'badge',
          todo.priority === 'high' && 'high',
          todo.priority === 'medium' && 'medium',
          todo.priority === 'low' && 'low'
        )}>
          <span className="badge-text-full">
            {todo.priority === 'high' ? 'สูง' : todo.priority === 'medium' ? 'ปานกลาง' : 'ต่ำ'}
          </span>
          <span className="badge-text-short">
            {todo.priority === 'high' ? 'สูง' : todo.priority === 'medium' ? 'กลาง' : 'ต่ำ'}
          </span>
        </span>
        
        {!isEditing && (
          <div className="mobile-actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="icon-btn"
              type="button"
              title="แก้ไข"
              aria-label="แก้ไข"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(todo.id);
              }}
              className="icon-btn"
              type="button"
              title="ลบ"
              aria-label="ลบ"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoItem;
