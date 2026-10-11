// @ts-nocheck
import React from 'react';
import Modal from './Modal';
import { AlertCircle, CloudDownload, Clock } from 'lucide-react';
import { formatDateTime } from '../utils/dates';

export default function DailyCheckModal({ isOpen, onClose, checkData, onReplaceWithRemote }) {
  if (!isOpen || !checkData) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Newer Database Found on Google Drive" maxWidth="520px">
      <div className="daily-check-body">
        <div className="daily-check-icon-wrapper">
          <AlertCircle size={40} className="daily-check-icon" />
        </div>
        <p className="daily-check-desc">
          On today's initial check, a newer version of <strong>ACCDB.sqlite</strong> was detected on your Google Drive. 
          Someone may have updated the accounting database from another computer.
        </p>

        <div className="timestamps-box">
          <div className="timestamp-row">
            <span className="timestamp-label">
              <CloudDownload size={16} /> Remote (Google Drive):
            </span>
            <span className="timestamp-val highlight">{formatDateTime(checkData.remoteTime)}</span>
          </div>
          <div className="timestamp-row">
            <span className="timestamp-label">
              <Clock size={16} /> Your Local Copy:
            </span>
            <span className="timestamp-val">{formatDateTime(checkData.localTime)}</span>
          </div>
        </div>

        <p className="daily-check-subtext">
          Would you like to replace your local database with the newer remote version from Google Drive?
        </p>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Keep Local Copy
          </button>
          <button className="btn btn-primary" onClick={onReplaceWithRemote}>
            <CloudDownload size={16} />
            Replace Local with Remote
          </button>
        </div>
      </div>
    </Modal>
  );
}
