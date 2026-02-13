import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info, Trash2, RotateCcw } from 'lucide-react';
import { cn } from '../utils/cn';

type ToastType = 'success' | 'error' | 'info' | 'undo';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  undoAction?: () => void;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType, duration?: number, undoAction?: () => void) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Item Component
const ToastItem = ({ 
  toast, 
  onClose 
}: { 
  toast: Toast; 
  onClose: (id: string) => void;
}) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5" style={{ color: 'var(--success-500)' }} />,
    error: <AlertCircle className="w-5 h-5" style={{ color: 'var(--error-500)' }} />,
    info: <Info className="w-5 h-5" style={{ color: 'var(--primary-500)' }} />,
    undo: <Trash2 className="w-5 h-5" style={{ color: 'var(--error-500)' }} />,
  };

  const handleUndo = () => {
    if (toast.undoAction) {
      toast.undoAction();
    }
    onClose(toast.id);
  };

  return (
    <div
      className={cn(
        'toast-item',
        toast.type === 'success' && 'toast-success',
        toast.type === 'error' && 'toast-error',
        toast.type === 'info' && 'toast-info',
        toast.type === 'undo' && 'toast-undo'
      )}
      style={{ animationDelay: '0ms' }}
    >
      <div className="toast-icon">
        {icons[toast.type]}
      </div>
      <div className="toast-content">
        <span className="toast-message">{toast.message}</span>
      </div>
      {toast.type === 'undo' && toast.undoAction && (
        <button 
          onClick={handleUndo}
          className="toast-undo-btn"
          aria-label="ยกเลิก"
        >
          <RotateCcw className="w-4 h-4" />
          <span>ยกเลิก</span>
        </button>
      )}
      <button 
        onClick={() => onClose(toast.id)}
        className="toast-close"
        aria-label="ปิด"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Toast Provider
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((
    message: string, 
    type: ToastType = 'info', 
    duration = 3000,
    undoAction?: () => void
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, message, type, duration, undoAction };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss after duration (including undo toasts)
    const timer = setTimeout(() => {
      hideToast(id);
    }, duration);
    timersRef.current.set(id, timer);
  }, [hideToast]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            onClose={hideToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
