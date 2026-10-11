// @ts-nocheck
import React, { useState } from 'react';
import Modal from './Modal';
import { GitMerge, CloudDownload, UploadCloud, AlertTriangle, Check } from 'lucide-react';
import { formatDateTime } from '../utils/dates';

export default function ConflictModal({ isOpen, onClose, conflictData, onMerge, onKeepRemote, onForceOverwrite }) {
  const [loadingAction, setLoadingAction] = useState(null);

  if (!isOpen || !conflictData) return null;

  const handleAction = async (actionFn, actionName) => {
    try {
      setLoadingAction(actionName);
      await actionFn();
      onClose();
    } catch (err) {
      alert(`Conflict resolution error: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sync Conflict Detected" maxWidth="620px">
      <div className="conflict-modal-body">
        <div className="conflict-banner">
          <AlertTriangle size={32} className="conflict-icon" />
          <div>
            <strong>Google Drive has a newer database version!</strong>
            <p className="conflict-banner-desc">
              Both your computer and another session have made unsynchronized changes to the accounting database.
            </p>
          </div>
        </div>

        <div className="timestamps-box">
          <div className="timestamp-row">
            <span className="timestamp-label">Remote Google Drive:</span>
            <span className="timestamp-val highlight">{formatDateTime(conflictData.remoteTime)}</span>
          </div>
          <div className="timestamp-row">
            <span className="timestamp-label">Last Synced Timestamp:</span>
            <span className="timestamp-val">{formatDateTime(conflictData.lastSyncedTime)}</span>
          </div>
        </div>

        <div className="conflict-options">
          {/* Option 1: Best Effort Merge */}
          <div className="conflict-card recommended">
            <div className="conflict-card-header">
              <span className="badge badge-success">Recommended</span>
              <GitMerge size={20} className="conflict-option-icon" />
            </div>
            <h4>Best-Effort Client-Side Merge</h4>
            <p>
              Downloads the remote database into a temporary OPFS file, attaches it with SQLite 
              <code>ATTACH DATABASE</code>, and synchronizes rows across all tables using the latest modification timestamps. 
              Uploads the merged database back to Google Drive.
            </p>
            <button 
              className="btn btn-primary btn-block"
              disabled={Boolean(loadingAction)}
              onClick={() => handleAction(onMerge, 'merge')}
            >
              <GitMerge size={16} />
              {loadingAction === 'merge' ? 'Merging with SQLite...' : 'Merge & Sync to Drive'}
            </button>
          </div>

          <div className="conflict-grid-2">
            {/* Option 2: Keep Remote */}
            <div className="conflict-card">
              <h4>Discard Local Edits</h4>
              <p>
                Replace your local database with the newer remote version from Google Drive. Your local changes since the last sync will be lost.
              </p>
              <button 
                className="btn btn-secondary btn-block"
                disabled={Boolean(loadingAction)}
                onClick={() => handleAction(onKeepRemote, 'keep_remote')}
              >
                <CloudDownload size={16} />
                {loadingAction === 'keep_remote' ? 'Loading Remote...' : 'Keep Remote Copy'}
              </button>
            </div>

            {/* Option 3: Force Overwrite */}
            <div className="conflict-card">
              <h4>Force Overwrite Remote</h4>
              <p>
                Overwrite the remote Google Drive file with your local database. The remote changes made by the other session will be replaced.
              </p>
              <button 
                className="btn btn-danger btn-block"
                disabled={Boolean(loadingAction)}
                onClick={() => handleAction(onForceOverwrite, 'overwrite')}
              >
                <UploadCloud size={16} />
                {loadingAction === 'overwrite' ? 'Overwriting...' : 'Overwrite Remote'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
