import React, { useState, useEffect } from 'react';
import { driveService } from '../services/driveService';
import { syncService } from '../services/syncService';
import { dbService } from '../services/dbService';
import { exportAllDataToExcel } from '../services/excelService';
import { formatDateTime } from '../utils/dates';
import { 
  CloudUpload, 
  CloudDownload, 
  Save, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  Key, 
  Info,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';

export default function SyncBackupTab({ 
  onSaveOPFS, 
  onSaveAndSync, 
  onExportExcel, 
  isSaving, 
  isSyncing,
  lastSaveTime,
  driveConnected,
  onRefreshData,
  showToast 
}) {
  const [clientId, setClientId] = useState(driveService.getClientId());
  const [showClientId, setShowClientId] = useState(false);
  const [clientIdSaved, setClientIdSaved] = useState(false);
  const [lastSyncIso, setLastSyncIso] = useState(localStorage.getItem('last_synced_iso') || '');
  const [lastDriveFileId, setLastDriveFileId] = useState(localStorage.getItem('last_drive_file_id') || '');
  const [isPulling, setIsPulling] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  useEffect(() => {
    setLastSyncIso(localStorage.getItem('last_synced_iso') || '');
    setLastDriveFileId(localStorage.getItem('last_drive_file_id') || '');
  }, [isSyncing, isPulling, driveConnected]);

  const handleSaveClientId = (e) => {
    e.preventDefault();
    driveService.setClientId(clientId);
    setClientIdSaved(true);
    showToast('Google OAuth Client ID saved successfully', 'success');
    setTimeout(() => setClientIdSaved(false), 3000);
  };

  const handleConnectDrive = async () => {
    try {
      await driveService.authenticate(true);
      showToast('Successfully authenticated with Google Drive!', 'success');
      onRefreshData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Manual pull & replace local with remote
  const handlePullRemote = async () => {
    if (!window.confirm('This will replace your current local database with the copy currently stored on Google Drive. Proceed?')) {
      return;
    }
    try {
      setIsPulling(true);
      const res = await syncService.pullRemoteReplaceLocal();
      setLastSyncIso(res.file.modifiedTime);
      showToast(`Successfully replaced local database from Google Drive (${res.file.name})`, 'success');
      onRefreshData();
    } catch (err) {
      showToast(`Pull failed: ${err.message}`, 'error');
    } finally {
      setIsPulling(false);
    }
  };

  // Download raw .sqlite file
  const handleDownloadSqlite = async () => {
    try {
      const binary = await dbService.exportBinary();
      if (!binary) throw new Error('Could not read SQLite database binary');
      const blob = new Blob([binary], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ACCDB_${new Date().toISOString().split('T')[0]}.sqlite`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded ACCDB.sqlite to your computer', 'success');
    } catch (err) {
      showToast(`Download failed: ${err.message}`, 'error');
    }
  };

  // Restore from raw .sqlite file input
  const handleFileRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm(`Restore database from file "${file.name}"? This will replace your local data.`)) {
      e.target.value = '';
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      await dbService.importBinary(uint8);
      showToast(`Database restored successfully from "${file.name}"`, 'success');
      onRefreshData();
    } catch (err) {
      showToast(`Restore failed: ${err.message}`, 'error');
    } finally {
      e.target.value = '';
    }
  };

  // Handle Excel Export
  const handleExcelExport = async () => {
    try {
      setIsExportingExcel(true);
      const filename = await exportAllDataToExcel();
      showToast(`Exported all data to Excel: ${filename}`, 'success');
    } catch (err) {
      showToast(`Excel export failed: ${err.message}`, 'error');
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="tab-pane-content">
      <div className="grid-2-cols">
        {/* Card 1: Local OPFS Persistence */}
        <div className="content-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-title">Browser Origin Private File System (OPFS)</h3>
              <p className="card-subtitle">Zero-latency local relational SQLite database storage</p>
            </div>
            <Database size={24} className="text-primary" />
          </div>

          <div className="status-box mt-3">
            <div className="status-row">
              <span className="status-label">Database File:</span>
              <span className="status-val font-mono">ACCDB.sqlite</span>
            </div>
            <div className="status-row">
              <span className="status-label">Storage Engine:</span>
              <span className="status-val badge badge-success">SQLite WASM (OPFS)</span>
            </div>
            <div className="status-row">
              <span className="status-label">Last Saved to OPFS:</span>
              <span className="status-val">{lastSaveTime ? formatDateTime(lastSaveTime) : 'Session start'}</span>
            </div>
          </div>

          <p className="text-sm text-muted mt-3">
            Your data is stored in the browser's high-performance sandboxed filesystem. 
            Clicking <strong>Save</strong> persists all pending transactions to <code>ACCDB.sqlite</code> immediately.
          </p>

          <div className="mt-4">
            <button 
              className="btn btn-accent btn-block"
              onClick={onSaveOPFS}
              disabled={isSaving}
            >
              <Save size={16} />
              {isSaving ? 'Saving to Local OPFS...' : 'Save to OPFS ("Save")'}
            </button>
          </div>
        </div>

        {/* Card 2: Google Drive OAuth2 Sync */}
        <div className="content-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-title">Google Drive Cloud Synchronization</h3>
              <p className="card-subtitle">Backup and sync across devices using Google Drive API</p>
            </div>
            <CloudUpload size={24} className="text-primary" />
          </div>

          {/* Client ID Configuration */}
          <form onSubmit={handleSaveClientId} className="oauth-setup-box mt-3">
            <div className="form-group">
              <label className="form-label">
                <Key size={14} className="inline mr-1" /> Google OAuth 2.0 Client ID
              </label>
              <div className="input-group">
                <input
                  type={showClientId ? "text" : "password"}
                  className="form-control font-mono text-sm"
                  placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowClientId(!showClientId)}
                  title={showClientId ? "Hide Client ID" : "Show Client ID"}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  {showClientId ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showClientId ? 'Hide' : 'Show'}</span>
                </button>
                <button type="submit" className="btn btn-sm btn-secondary">
                  Save ID
                </button>
              </div>
              <span className="text-xs text-muted mt-1 block">
                Saved in encrypted browser storage. Uses Google Identity Services with <code>drive.file</code> scope.
              </span>
            </div>
          </form>

          <div className="status-box mt-3">
            <div className="status-row">
              <span className="status-label">Drive Connection:</span>
              <span className={`status-val badge ${driveConnected ? 'badge-success' : 'badge-muted'}`}>
                {driveConnected ? 'Connected & Authorized' : 'Not Connected'}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">Target File:</span>
              <span className="status-val flex items-center gap-2">
                <span className="font-mono font-semibold">ACCDB.sqlite</span>
                {lastSyncIso && (
                  <a
                    href={lastDriveFileId ? `https://drive.google.com/file/d/${lastDriveFileId}/view` : 'https://drive.google.com/drive/search?q=ACCDB.sqlite'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline-primary"
                    style={{ padding: '2px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Open ACCDB.sqlite in Google Drive"
                  >
                    <ExternalLink size={12} /> View in Google Drive
                  </a>
                )}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">Last Synced to Drive:</span>
              <span className="status-val">{lastSyncIso ? formatDateTime(lastSyncIso) : 'Not synced yet'}</span>
            </div>
          </div>

          <div className="btn-group-2 mt-4">
            {!driveConnected ? (
              <button 
                className="btn btn-secondary"
                onClick={handleConnectDrive}
                disabled={!clientId}
              >
                <Key size={16} /> Connect Google Drive
              </button>
            ) : (
              <button 
                className="btn btn-secondary"
                onClick={handleConnectDrive}
              >
                <RefreshCw size={16} /> Re-authorize Drive
              </button>
            )}

            <button 
              className="btn btn-primary"
              onClick={onSaveAndSync}
              disabled={isSyncing || !clientId}
            >
              <CloudUpload size={16} />
              {isSyncing ? 'Syncing...' : 'Save & Sync'}
            </button>
          </div>

          <div className="mt-3">
            <button 
              className="btn btn-outline-warning btn-block"
              onClick={handlePullRemote}
              disabled={isPulling || !clientId}
              title="Replace your local database with Google Drive ACCDB.sqlite"
            >
              <CloudDownload size={16} />
              {isPulling ? 'Pulling Remote...' : 'Replace Local with Remote from Drive'}
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Direct File Backups & Excel Reports */}
      <div className="grid-2-cols mt-6">
        {/* Excel Export */}
        <div className="content-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-title">Comprehensive Excel Export</h3>
              <p className="card-subtitle">Download multi-sheet spreadsheet workbook via SheetJS</p>
            </div>
            <FileSpreadsheet size={24} className="text-success" />
          </div>

          <p className="text-sm text-muted mt-2">
            Exports your complete database records into a single formatted Excel workbook (<code>.xlsx</code>):
          </p>

          <ul className="sheet-list mt-2">
            <li><strong>Sheet 1:</strong> Students directory and fee records</li>
            <li><strong>Sheet 2:</strong> Teachers directory and qualifications</li>
            <li><strong>Sheet 3:</strong> Weekly Scheduled Recurring Lessons</li>
            <li><strong>Sheet 4:</strong> Adhoc Lesson Sessions history</li>
            <li><strong>Sheet 5:</strong> Student Payments Ledger (Snapshot Amounts)</li>
            <li><strong>Sheet 6:</strong> Teacher Salaries Ledger (Snapshot Amounts)</li>
            <li><strong>Sheet 7:</strong> Category Rate Templates & Matrix</li>
            <li><strong>Sheet 8:</strong> Customized Rate Overrides</li>
          </ul>

          <div className="mt-4">
            <button 
              className="btn btn-success btn-block"
              onClick={handleExcelExport}
              disabled={isExportingExcel}
            >
              <FileSpreadsheet size={16} />
              {isExportingExcel ? 'Generating Spreadsheet...' : 'Export All Data to Excel (.xlsx)'}
            </button>
          </div>
        </div>

        {/* Direct SQLite File Backup / Restore */}
        <div className="content-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-title">Offline File Backup & Restore</h3>
              <p className="card-subtitle">Direct import/export of ACCDB.sqlite file</p>
            </div>
            <Database size={24} className="text-primary" />
          </div>

          <p className="text-sm text-muted mt-2">
            You can manually download a standalone copy of your SQLite database at any time, 
            or restore an existing <code>.sqlite</code> file from your computer.
          </p>

          <div className="backup-actions-grid mt-4">
            <button 
              className="btn btn-secondary btn-block"
              onClick={handleDownloadSqlite}
            >
              <Download size={16} /> Download <code>ACCDB.sqlite</code>
            </button>

            <div className="file-upload-wrap">
              <label className="btn btn-secondary btn-block file-upload-label">
                <Upload size={16} /> Restore from <code>.sqlite</code> File
                <input 
                  type="file" 
                  accept=".sqlite,.db" 
                  className="hidden-file-input"
                  onChange={handleFileRestore} 
                />
              </label>
            </div>
          </div>

          <div className="info-callout mt-4">
            <Info size={16} className="text-info inline mr-1" />
            <span className="text-xs text-muted">
              Because this webpage runs 100% on the client side, your database never touches a third-party server. 
              Only you and your authorized Google Drive hold your school's financial records.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
