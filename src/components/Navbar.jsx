import React from 'react';
import { 
  Save, 
  CloudUpload, 
  FileSpreadsheet, 
  Users, 
  GraduationCap, 
  Calendar, 
  CreditCard, 
  Wallet, 
  Settings2, 
  Layers,
  LayoutDashboard,
  Sun,
  Moon
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  onSelectTab, 
  onSaveOPFS, 
  onSaveAndSync, 
  onExportExcel,
  isSaving, 
  isSyncing,
  driveConnected,
  isDarkMode,
  onToggleDarkMode
}) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'teachers', label: 'Teachers', icon: GraduationCap },
    { id: 'lessons', label: 'Lessons & Adhoc', icon: Calendar },
    { id: 'payments', label: 'Student Fees', icon: CreditCard },
    { id: 'salaries', label: 'Teacher Salaries', icon: Wallet },
    { id: 'templates', label: 'Rate Templates', icon: Settings2 },
    { id: 'sync', label: 'Sync & Backup', icon: Layers },
  ];

  return (
    <header className="navbar-container">
      <div className="navbar-top">
        <div className="navbar-brand">
          <img 
            src="./logo.jpg" 
            alt="School Logo" 
            className="navbar-logo" 
            onError={(e) => {
              // fallback if local file path differs
              e.currentTarget.src = 'https://i.postimg.cc/hGVyqvXD/Untitled-School-Acounting-Static-Webpage.jpg';
            }}
          />
          <div className="navbar-title-wrap">
            <h1 className="navbar-title">Music School Accounting</h1>
            <span className="navbar-subtitle">Static Accounting & Lesson Scheduler</span>
          </div>
        </div>

        <div className="navbar-actions">
          {/* Quick OPFS & Drive Status */}
          <div className="status-indicators">
            <span className="badge badge-opfs" title="Database persisted locally in Origin Private File System">
              <span className="status-dot green"></span> OPFS Active
            </span>
            <span className={`badge ${driveConnected ? 'badge-drive-connected' : 'badge-drive-idle'}`}>
              <span className={`status-dot ${driveConnected ? 'blue' : 'gray'}`}></span>
              {driveConnected ? 'Drive Connected' : 'Drive Standby'}
            </span>
          </div>

          {/* Dark Mode Toggle */}
          <button
            className="btn btn-secondary btn-icon"
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{ padding: '0.55rem', borderRadius: '50%' }}
          >
            {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Quick Export */}
          <button 
            className="btn btn-secondary btn-icon" 
            onClick={onExportExcel}
            title="Export all school data to multi-sheet Excel (.xlsx)"
          >
            <FileSpreadsheet size={16} />
            <span className="btn-text">Export Excel</span>
          </button>

          {/* Save to OPFS button */}
          <button 
            className="btn btn-accent btn-icon" 
            onClick={onSaveOPFS} 
            disabled={isSaving}
            title="Save local database file to browser Origin Private File System"
          >
            <Save size={16} />
            <span className="btn-text">{isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          {/* Save & Sync to Drive */}
          <button 
            className="btn btn-primary btn-icon" 
            onClick={onSaveAndSync} 
            disabled={isSyncing}
            title="Save to local OPFS and sync ACCDB.sqlite with Google Drive"
          >
            <CloudUpload size={16} />
            <span className="btn-text">{isSyncing ? 'Syncing...' : 'Save & Sync'}</span>
          </button>
        </div>
      </div>

      <nav className="navbar-tabs" aria-label="Main Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              <Icon size={16} className="nav-tab-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
