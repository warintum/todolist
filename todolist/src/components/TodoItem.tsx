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
    year: 'numeric',
  });

  return (
    <div className="card todo-item">
      <button
        onClick={() => onToggle(todo.id)}
        className={cn('todo-checkbox', todo.completed && 'checked')}
        aria-label={todo.completed ? 'mark as incomplete' : 'mark as complete'}
        type="button"
      >
        {todo.completed && <Check className="w-3 h-3" />}
      </button>
      
      <div className="flex-1">
        {isEditing ? (
          <div className="flex items-center gap-2">
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
            />
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="input"
            />
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="select"
            >
              <option value="low">ต่ำ</option>
              <option value="medium">ปานกลาง</option>
              <option value="high">สูง</option>
            </select>
            <button
              onClick={handleSave}
              className="icon-btn"
              type="button"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="icon-btn"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="todo-content" onClick={() => setIsEditing(true)}>
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
      
      <div className="flex items-center gap-2">
        <span className={cn(
          'badge',
          todo.priority === 'high' && 'high',
          todo.priority === 'medium' && 'medium',
          todo.priority === 'low' && 'low'
        )}>
          {todo.priority === 'high' ? 'สูง' : todo.priority === 'medium' ? 'ปานกลาง' : 'ต่ำ'}
        </span>
        <button
          onClick={() => setIsEditing(true)}
          className="icon-btn"
          type="button"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          className="icon-btn"
          type="button"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TodoItem;
