import { useState } from 'react';
import type { Todo } from '../utils/todoTypes';
import { cn } from '../utils/cn';
import { Check, Trash2, Edit2, X } from 'lucide-react';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string, createdAt: Date, priority: 'low' | 'medium' | 'high') => void;
}

const TodoItem = ({ todo, onToggle, onDelete, onEdit }: TodoItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [editDate, setEditDate] = useState(
    new Date(todo.createdAt).toISOString().split('T')[0]
  );
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>(todo.priority);

  const handleSave = () => {
    if (editText.trim()) {
      onEdit(todo.id, editText.trim(), new Date(editDate), editPriority);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditText(todo.text);
    setEditDate(new Date(todo.createdAt).toISOString().split('T')[0]);
    setEditPriority(todo.priority);
    setIsEditing(false);
  };

  const createdAtLabel = new Date(todo.createdAt).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
  });

  return (
    <div className="card todo-item">
      <button
        onClick={() => onToggle(todo.id)}
        className={cn('todo-checkbox', todo.completed && 'checked')}
        aria-label={todo.completed ? 'mark as incomplete' : 'mark as complete'}
        type="button"
      >
        {todo.completed && <Check className="w-4 h-4" strokeWidth={3} />}
      </button>
      
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="edit-row">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              className="input"
              autoFocus
              placeholder="แก้ไขข้อความ..."
            />
            <div className="edit-row-secondary">
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="input"
                aria-label="เลือกวันที่"
              />
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="select"
                aria-label="เลือกความสำคัญ"
              >
                <option value="low">ต่ำ</option>
                <option value="medium">ปานกลาง</option>
                <option value="high">สูง</option>
              </select>
              <button
                onClick={handleSave}
                className="icon-btn"
                type="button"
                title="บันทึก"
                aria-label="บันทึก"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancel}
                className="icon-btn"
                type="button"
                title="ยกเลิก"
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
          >
            <span
              className={cn(
                'todo-text',
                todo.completed && 'completed'
              )}
            >
              {todo.text}
            </span>
            <span className="todo-date">{createdAtLabel}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
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
      </div>
    </div>
  );
};

export default TodoItem;
