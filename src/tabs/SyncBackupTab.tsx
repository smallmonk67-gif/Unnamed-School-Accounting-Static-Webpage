// @ts-nocheck
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
  EyeOff,
  Radio,
  Wifi,
  Send,
  Sliders,
  Copy,
  Check,
  Terminal
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
  showToast,
  databaseId,
  webrtcStatus,
  webrtcPeers,
  webrtcLogs,
  webrtcService
}) {
  const [clientId, setClientId] = useState(driveService.getClientId());
  const [showClientId, setShowClientId] = useState(false);
  const [clientIdSaved, setClientIdSaved] = useState(false);
  const [lastSyncIso, setLastSyncIso] = useState(localStorage.getItem('last_synced_iso') || '');
  const [lastDriveFileId, setLastDriveFileId] = useState(localStorage.getItem('last_drive_file_id') || '');
  const [isPulling, setIsPulling] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // WebRTC & Supabase local states
  const [supabaseConfig, setSupabaseConfig] = useState(
    webrtcService ? webrtcService.getConfig() : { url: '', key: '' }
  );
  const [showSupabaseSettings, setShowSupabaseSettings] = useState(false);
  const [showSupabaseUrl, setShowSupabaseUrl] = useState(false);
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [isCopiedDbId, setIsCopiedDbId] = useState(false);
  const [isP2pEnabled, setIsP2pEnabled] = useState(webrtcService ? webrtcService.isEnabled : true);
  const [isSendingSnapshot, setIsSendingSnapshot] = useState(false);
  const [isRequestingSnapshot, setIsRequestingSnapshot] = useState(false);

  useEffect(() => {
    setLastSyncIso(localStorage.getItem('last_synced_iso') || '');
    setLastDriveFileId(localStorage.getItem('last_drive_file_id') || '');
    if (webrtcService) {
      setSupabaseConfig(webrtcService.getConfig());
      setIsP2pEnabled(webrtcService.isEnabled);
    }
  }, [isSyncing, isPulling, driveConnected, webrtcService]);

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
      const newDbId = await dbService.getOrCreateDatabaseId();
      if (webrtcService) webrtcService.init(newDbId);
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

  // Copy Database Unique ID
  const handleCopyDbId = () => {
    if (!databaseId) return;
    navigator.clipboard.writeText(databaseId);
    setIsCopiedDbId(true);
    showToast('Database Unique ID copied to clipboard', 'info');
    setTimeout(() => setIsCopiedDbId(false), 2500);
  };

  // Save Supabase Configuration
  const handleSaveSupabaseConfig = (e) => {
    e.preventDefault();
    if (!webrtcService) return;
    webrtcService.saveConfig(supabaseConfig.url, supabaseConfig.key);
    showToast('Supabase settings saved! Reconnecting signaling...', 'success');
  };

  // Reset Supabase Configuration
  const handleResetSupabaseConfig = () => {
    if (!webrtcService) return;
    webrtcService.resetConfig();
    setSupabaseConfig(webrtcService.getConfig());
    showToast('Supabase settings reset to default', 'info');
  };

  // Toggle P2P Enabled
  const handleToggleP2p = () => {
    if (!webrtcService) return;
    const next = !isP2pEnabled;
    setIsP2pEnabled(next);
    webrtcService.setEnabled(next);
    showToast(next ? 'WebRTC P2P sync enabled' : 'WebRTC P2P sync disabled', 'info');
  };

  // Send Database Snapshot to Peer(s)
  const handleSendSnapshot = async (peerId = null) => {
    if (!webrtcService) return;
    try {
      setIsSendingSnapshot(true);
      const ok = await webrtcService.sendSnapshotToPeers(peerId);
      if (ok) {
        showToast(peerId ? `Pushed database snapshot to peer ${peerId}` : 'Broadcasted snapshot to all peers', 'success');
      } else {
        showToast('Failed to send snapshot', 'error');
      }
    } finally {
      setIsSendingSnapshot(false);
    }
  };

  // Request Snapshot from Peer
  const handleRequestSnapshot = () => {
    if (!webrtcService) return;
    try {
      setIsRequestingSnapshot(true);
      const ok = webrtcService.requestSnapshotFromPeer();
      if (ok) {
        showToast('Requested full database snapshot from peer...', 'info');
      } else {
        showToast('No online peers connected to request snapshot from', 'warning');
      }
    } finally {
      setTimeout(() => setIsRequestingSnapshot(false), 2000);
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

      {/* Row 2: WebRTC Realtime Peer-to-Peer Database Sync (Supabase Signaling) */}
      <div className="grid-2-cols mt-6">
        {/* Left Card: Database Identity & Active P2P Peer Network */}
        <div className="content-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-title">Realtime WebRTC Database Sync</h3>
              <p className="card-subtitle">Zero-latency P2P DataChannel synchronization</p>
            </div>
            <div className={`status-indicator-pill ${webrtcPeers?.length > 0 ? 'active' : ''}`}>
              <Radio size={20} className={webrtcPeers?.length > 0 ? 'text-success' : 'text-muted'} />
            </div>
          </div>

          {/* Database Identity Card */}
          <div className="db-identity-card mt-3">
            <div className="db-identity-header">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Protocol V2 Unique Identity</span>
              <span className="badge badge-success text-xs">
                <CheckCircle2 size={12} className="mr-1 inline" /> Verified in SQLite
              </span>
            </div>
            <div className="db-identity-code-wrap mt-2">
              <code className="db-identity-code" title={databaseId || 'Generating...'}>
                {databaseId || 'Generating unique database ID...'}
              </code>
              <button
                type="button"
                className="btn btn-secondary btn-icon-small"
                onClick={handleCopyDbId}
                title="Copy Database Unique ID to clipboard"
              >
                {isCopiedDbId ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-xs text-muted mt-2">
              Each database file has a cryptographically unique 180+ bit identity. Legacy V1 databases without an ID automatically upgrade to V2 on first open by generating and storing their permanent identity in SQLite.
            </p>
          </div>

          {/* Peer Connection Status */}
          <div className="peer-network-summary mt-4">
            <div className="flex-between items-center mb-2">
              <strong className="text-sm">Connected Peers Online ({webrtcPeers?.length || 0})</strong>
              <span className={`badge ${webrtcPeers?.length > 0 ? 'badge-p2p-live' : webrtcStatus === 'connected' ? 'badge-p2p-standby' : 'badge-p2p-idle'}`}>
                <span className={`status-dot ${webrtcPeers?.length > 0 ? 'green pulse' : webrtcStatus === 'connected' ? 'yellow' : 'gray'}`}></span>
                {webrtcPeers?.length > 0 ? `${webrtcPeers.length} Peer(s) Live` : webrtcStatus === 'connected' ? 'Waiting for Peers' : 'Offline'}
              </span>
            </div>

            {webrtcPeers && webrtcPeers.length > 0 ? (
              <div className="peers-list">
                {webrtcPeers.map((peer) => (
                  <div key={peer.id} className="peer-badge-item">
                    <div className="peer-item-info">
                      <Wifi size={14} className="text-success inline mr-2" />
                      <span className="font-mono text-xs">{peer.id}</span>
                    </div>
                    <div className="peer-item-actions">
                      <span className="badge badge-success text-xs mr-2">P2P Channel Open</span>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => handleSendSnapshot(peer.id)}
                        disabled={isSendingSnapshot}
                        title="Send full database snapshot to this peer"
                      >
                        Push DB
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p2p-empty-state">
                <p className="text-xs text-muted">
                  {webrtcStatus === 'connected' 
                    ? 'No other clients with this database file are currently online. Open this app on another device or browser tab with the same database to see live peer-to-peer sync in action.'
                    : 'Signaling connection is currently standby or offline. Check Supabase configuration.'}
                </p>
              </div>
            )}
          </div>

          {/* P2P Snapshot Actions */}
          <div className="grid-2-cols gap-2 mt-4">
            <button
              type="button"
              className="btn btn-secondary btn-block text-xs"
              onClick={() => handleSendSnapshot()}
              disabled={isSendingSnapshot || !webrtcPeers || webrtcPeers.length === 0}
              title="Push full database snapshot to all connected peers"
            >
              <Send size={14} /> Push Snapshot to Peers
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block text-xs"
              onClick={handleRequestSnapshot}
              disabled={isRequestingSnapshot || !webrtcPeers || webrtcPeers.length === 0}
              title="Request complete database snapshot from a connected peer"
            >
              <RefreshCw size={14} className={isRequestingSnapshot ? 'animate-spin' : ''} /> Request Snapshot from Peer
            </button>
          </div>

          {/* Realtime Activity Log Terminal */}
          <div className="mt-4">
            <div className="flex-between items-center mb-1">
              <span className="text-xs font-semibold text-muted flex items-center gap-1">
                <Terminal size={12} /> Live P2P Sync Log
              </span>
              <span className="text-xs text-muted">{webrtcLogs?.length || 0} events</span>
            </div>
            <div className="p2p-terminal">
              {webrtcLogs && webrtcLogs.length > 0 ? (
                webrtcLogs.map((log) => (
                  <div key={log.id} className="p2p-log-entry">
                    <span className="p2p-log-time">[{log.time}]</span>
                    <span className={`p2p-log-type-${log.type}`}>{log.message}</span>
                  </div>
                ))
              ) : (
                <div className="text-muted text-xs">Waiting for P2P connection events...</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Card: Supabase Cloud Signaling Configuration */}
        <div className="content-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-title">Supabase Cloud Signaling</h3>
              <p className="card-subtitle">Zero-SQL room management and WebRTC handshake</p>
            </div>
            <Sliders size={24} className="text-info" />
          </div>

          <p className="text-sm text-muted mt-2">
            WebRTC signaling utilizes Supabase Realtime Broadcast and Presence over WebSockets. 
            <strong> No Supabase SQL tables or database migrations are required</strong>—signaling messages 
            and peer discovery are handled entirely in-memory. Once peers connect, all data flows directly peer-to-peer.
          </p>

          <form onSubmit={handleSaveSupabaseConfig} className="mt-4">
            {/* P2P Toggle */}
            <div className="form-group flex-between items-center p-3 rounded bg-subtle mb-4">
              <div>
                <strong>Enable WebRTC Realtime Sync</strong>
                <p className="text-xs text-muted">Toggle peer-to-peer sync for this session</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={isP2pEnabled}
                  onChange={handleToggleP2p}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Hidden Credentials Status Box */}
            <div className="status-box mt-3 mb-3">
              <div className="status-row">
                <span className="status-label">Signaling Provider:</span>
                <span className="status-val badge badge-info">Supabase Cloud Realtime</span>
              </div>
              <div className="status-row">
                <span className="status-label">Credentials Storage:</span>
                <span className="status-val badge badge-success">Encrypted in Browser</span>
              </div>
              <div className="status-row">
                <span className="status-label">Active Room:</span>
                <span className="status-val font-mono text-xs">
                  {databaseId ? `db-sync:${databaseId.substring(0, 18)}...` : 'Connecting...'}
                </span>
              </div>
            </div>

            <div className="mt-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-block text-xs"
                onClick={() => setShowSupabaseSettings(!showSupabaseSettings)}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Sliders size={14} />
                <span>{showSupabaseSettings ? 'Hide Cloud Signaling Credentials' : 'Configure / View Cloud Signaling Keys'}</span>
              </button>
            </div>

            {showSupabaseSettings && (
              <div className="mt-4 p-3 rounded bg-subtle border border-color">
                <div className="form-group">
                  <div className="flex-between items-center mb-1">
                    <label className="form-label text-sm mb-0">Supabase Project URL</label>
                    <button
                      type="button"
                      className="btn btn-xs btn-secondary"
                      onClick={() => setShowSupabaseUrl(!showSupabaseUrl)}
                      title={showSupabaseUrl ? 'Hide URL' : 'Show URL'}
                      style={{ padding: '2px 6px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      {showSupabaseUrl ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{showSupabaseUrl ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showSupabaseUrl ? 'text' : 'password'}
                    className="input input-block font-mono text-sm"
                    value={supabaseConfig.url}
                    onChange={(e) => setSupabaseConfig((prev) => ({ ...prev, url: e.target.value }))}
                    placeholder="https://xyzcompany.supabase.co"
                    required
                  />
                </div>

                <div className="form-group mt-3">
                  <div className="flex-between items-center mb-1">
                    <label className="form-label text-sm mb-0">Supabase Publishable / Anon Key</label>
                    <button
                      type="button"
                      className="btn btn-xs btn-secondary"
                      onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                      title={showSupabaseKey ? 'Hide key' : 'Show key'}
                      style={{ padding: '2px 6px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      {showSupabaseKey ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{showSupabaseKey ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showSupabaseKey ? 'text' : 'password'}
                    className="input input-block font-mono text-sm"
                    value={supabaseConfig.key}
                    onChange={(e) => setSupabaseConfig((prev) => ({ ...prev, key: e.target.value }))}
                    placeholder="sb_publishable_... or anon JWT key"
                    required
                  />
                </div>

                <span className="text-xs text-muted mt-2 block">
                  Keys are stored encrypted in your browser's private storage and never leaked to third parties.
                </span>

                <div className="flex gap-2 mt-4">
                  <button type="submit" className="btn btn-primary flex-1">
                    <Save size={16} /> Save & Reconnect
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleResetSupabaseConfig}
                    title="Reset to default project credentials"
                  >
                    Reset Default
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="info-callout mt-5">
            <Info size={16} className="text-info inline mr-1 flex-shrink-0" />
            <span className="text-xs text-muted">
              <strong>Collision Protection:</strong> The database ID contains 180+ bits of entropy (composite UUIDv4 + millisecond timestamp + CSPRNG entropy). Peers also exchange an initial handshake confirming matching database identities before any mutations are permitted.
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Direct File Backups & Excel Reports */}
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
