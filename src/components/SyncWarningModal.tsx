// @ts-nocheck
import React, { useState } from 'react';
import Modal from './Modal';
import { AlertTriangle, CloudUpload, XCircle } from 'lucide-react';

export default function SyncWarningModal({ isOpen, onClose, onSync, onDontSync }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSync = async () => {
    try {
      setLoading(true);
      await onSync();
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const handleDontSync = () => {
    onDontSync();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Unsaved Changes Detected" maxWidth="500px">
      <div className="conflict-modal-body">
        <div className="conflict-banner">
          <AlertTriangle size={32} className="conflict-icon" style={{ color: 'var(--warning-color)' }} />
          <div>
            <strong>You have unsynced local changes!</strong>
            <p className="conflict-banner-desc">
              It looks like you're trying to leave the page, but your local database has modifications that haven't been synchronized to Google Drive yet.
            </p>
          </div>
        </div>

        <div className="conflict-options" style={{ marginTop: '20px' }}>
          <div className="conflict-card recommended">
            <div className="conflict-card-header">
              <span className="badge badge-success">Recommended</span>
              <CloudUpload size={20} className="conflict-option-icon" />
            </div>
            <h4>Sync to Google Drive</h4>
            <p>
              Save your changes to Google Drive before closing so they are available on other devices.
            </p>
            <button
              className="btn btn-primary btn-block"
              disabled={loading}
              onClick={handleSync}
            >
              <CloudUpload size={16} />
              {loading ? 'Syncing...' : 'Sync to Google Drive'}
            </button>
          </div>

          <div className="conflict-card" style={{ marginTop: '16px' }}>
            <h4>Don't Sync</h4>
            <p>
              Leave without syncing. You can sync manually later, or ignore this warning for the rest of this session.
            </p>
            <button
              className="btn btn-secondary btn-block"
              disabled={loading}
              onClick={handleDontSync}
            >
              <XCircle size={16} />
              Don't Sync
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
