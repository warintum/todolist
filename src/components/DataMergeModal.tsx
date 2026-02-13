import { AlertTriangle, Merge, Trash2, X, User, Database, Cloud } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';

interface DataMergeModalProps {
  isOpen: boolean;
  localCount: number;
  cloudCount: number;
  user: FirebaseUser | null;
  onMerge: () => void;
  onReplace: () => void;
  onCancel: () => void;
}

export function DataMergeModal({
  isOpen,
  localCount,
  cloudCount,
  user,
  onMerge,
  onReplace,
  onCancel,
}: DataMergeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content merge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon warning">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="modal-title">พบข้อมูลในเครื่อง</h3>
          <p className="modal-subtitle">
            คุณกำลังเข้าสู่ระบบด้วย <strong>{user?.email}</strong>
            <br />
            แต่มีข้อมูลในเครื่องที่ยังไม่ได้ซิงค์
          </p>
          <button 
            onClick={onCancel}
            className="modal-close"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body">
          {/* Data Comparison */}
          <div className="data-comparison">
            <div className="data-box local">
              <div className="data-icon">
                <Database className="w-5 h-5" />
              </div>
              <div className="data-info">
                <div className="data-label">ข้อมูลในเครื่อง</div>
                <div className="data-count">{localCount} รายการ</div>
                <div className="data-warning">ของผู้ใช้เดิม / ยังไม่ซิงค์</div>
              </div>
            </div>

            <div className="data-arrow">→</div>

            <div className="data-box cloud">
              <div className="data-icon">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="data-info">
                <div className="data-label">ข้อมูลบน Cloud</div>
                <div className="data-count">{cloudCount} รายการ</div>
                <div className="data-user">
                  <User className="w-3 h-3" />
                  {user?.displayName || user?.email}
                </div>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="merge-warning">
            <AlertTriangle className="w-4 h-4" />
            <span>
              หากเลือก "รวมข้อมูล" ข้อมูลจากเครื่องจะถูกเพิ่มเข้าไปใน Cloud ของ <strong>{user?.email}</strong>
            </span>
          </div>
        </div>

        <div className="modal-footer merge-footer">
          <button 
            onClick={onCancel}
            className="modal-btn modal-btn-secondary"
          >
            ยกเลิก
          </button>
          
          <button 
            onClick={onReplace}
            className="modal-btn modal-btn-danger"
          >
            <Trash2 className="w-4 h-4" />
            ลบข้อมูลเครื่อง
          </button>
          
          <button 
            onClick={onMerge}
            className="modal-btn modal-btn-primary"
          >
            <Merge className="w-4 h-4" />
            รวมข้อมูล
          </button>
        </div>
      </div>
    </div>
  );
}
