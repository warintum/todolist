import { LogOut, Trash2, Database, X } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  user: FirebaseUser | null;
  localDataCount: number;
  onKeepData: () => void;
  onDeleteData: () => void;
  onCancel: () => void;
}

export function LogoutConfirmModal({
  isOpen,
  user,
  localDataCount,
  onKeepData,
  onDeleteData,
  onCancel,
}: LogoutConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content logout-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon info">
            <LogOut className="w-6 h-6" />
          </div>
          <h3 className="modal-title">ออกจากระบบ</h3>
          <p className="modal-subtitle">
            คุณต้องการออกจากระบบ <strong>{user?.email}</strong>
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
          {/* Data info */}
          {localDataCount > 0 && (
            <div className="logout-data-info">
              <div className="data-info-box">
                <Database className="w-5 h-5" />
                <div>
                  <div className="data-info-label">ข้อมูลในเครื่อง</div>
                  <div className="data-info-count">{localDataCount} รายการ</div>
                </div>
              </div>
              
              <div className="logout-warning">
                <p>⚠️ ข้อมูลในเครื่องจะยังคงอยู่หากคุณเลือก "เก็บข้อมูลไว้"</p>
                <p>หากต้องการลบข้อมูลทั้งหมด ให้เลือก "ลบข้อมูลและออก"</p>
              </div>
            </div>
          )}

          {localDataCount === 0 && (
            <div className="logout-no-data">
              <p>ไม่มีข้อมูลในเครื่อง</p>
            </div>
          )}
        </div>

        <div className="modal-footer logout-footer">
          <button 
            onClick={onCancel}
            className="modal-btn modal-btn-secondary"
          >
            ยกเลิก
          </button>
          
          {localDataCount > 0 && (
            <button 
              onClick={onDeleteData}
              className="modal-btn modal-btn-danger"
            >
              <Trash2 className="w-4 h-4" />
              ลบข้อมูลและออก
            </button>
          )}
          
          <button 
            onClick={onKeepData}
            className="modal-btn modal-btn-primary"
          >
            <Database className="w-4 h-4" />
            {localDataCount > 0 ? 'เก็บข้อมูลไว้' : 'ออกจากระบบ'}
          </button>
        </div>
      </div>
    </div>
  );
}
