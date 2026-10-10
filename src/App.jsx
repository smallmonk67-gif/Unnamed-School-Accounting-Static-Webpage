import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import DailyCheckModal from './components/DailyCheckModal';
import ConflictModal from './components/ConflictModal';
import Toast from './components/Toast';

import OverviewTab from './tabs/OverviewTab';
import StudentsTab from './tabs/StudentsTab';
import TeachersTab from './tabs/TeachersTab';
import LessonsTab from './tabs/LessonsTab';
import PaymentsTab from './tabs/PaymentsTab';
import SalariesTab from './tabs/SalariesTab';
import RateTemplatesTab from './tabs/RateTemplatesTab';
import SyncBackupTab from './tabs/SyncBackupTab';

import { dbService } from './services/dbService';
import { syncService } from './services/syncService';
import { driveService } from './services/driveService';
import { exportAllDataToExcel } from './services/excelService';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(null);

  // Core database state
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rateTemplates, setRateTemplates] = useState([]);
  const [customizedRates, setCustomizedRates] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [adhocLessons, setAdhocLessons] = useState([]);
  const [payments, setPayments] = useState([]);
  const [salaries, setSalaries] = useState([]);

  // Operations state
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [driveConnected, setDriveConnected] = useState(driveService.isConnected());
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Modals state
  const [dailyCheckData, setDailyCheckData] = useState(null);
  const [conflictData, setConflictData] = useState(null);

  // Cross-tab interaction props
  const [prefilledStudentForPayment, setPrefilledStudentForPayment] = useState(null);
  const [prefilledTeacherForSalary, setPrefilledTeacherForSalary] = useState(null);
  const [editingLessonFromOverview, setEditingLessonFromOverview] = useState(null);

  // Toast helper
  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Reload all state from SQLite
  const reloadData = useCallback(async () => {
    try {
      const [
        s,
        t,
        q,
        c,
        rt,
        cr,
        msl,
        al,
        sp,
        ts,
        saveSetting
      ] = await Promise.all([
        dbService.getStudents(),
        dbService.getTeachers(),
        dbService.getTeacherQualifications(),
        dbService.getCategories(),
        dbService.getRateTemplates(),
        dbService.getCustomizedRates(),
        dbService.getMonthlyLessons(),
        dbService.getAdhocLessons(),
        dbService.getStudentPayments(),
        dbService.getTeacherSalaries(),
        dbService.getSetting('last_local_save', null)
      ]);

      setStudents(s);
      setTeachers(t);
      setQualifications(q);
      setCategories(c);
      setRateTemplates(rt);
      setCustomizedRates(cr);
      setLessons(msl);
      setAdhocLessons(al);
      setPayments(sp);
      setSalaries(ts);
      setLastSaveTime(saveSetting);
      setDriveConnected(driveService.isConnected());
    } catch (err) {
      console.error('Failed to load data:', err);
      showToast(`Data load error: ${err.message}`, 'error');
    }
  }, [showToast]);

  // Initial App Startup
  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        setIsInitializing(true);
        // Initialize SQLite WASM worker & OPFS
        await dbService.init();

        if (isMounted) {
          await reloadData();
          setIsInitializing(false);

          // Perform Daily Freshness Check against Google Drive
          setTimeout(async () => {
            try {
              const checkRes = await syncService.checkDailyFreshness();
              if (checkRes.shouldPrompt) {
                setDailyCheckData(checkRes);
              }
            } catch (checkErr) {
              console.warn('Daily freshness check error:', checkErr);
            }
          }, 1000);
        }
      } catch (err) {
        console.error('Bootstrap failed:', err);
        if (isMounted) {
          setInitError(err.message || String(err));
          setIsInitializing(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [reloadData]);

  // Handle Save to Local OPFS ("Save" Button)
  const handleSaveOPFS = async () => {
    try {
      setIsSaving(true);
      const res = await dbService.saveToOPFS();
      setLastSaveTime(res.timestamp);
      showToast('Database saved to browser OPFS (ACCDB.sqlite)', 'success');
    } catch (err) {
      showToast(`Save to OPFS failed: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Save & Sync to Google Drive
  const handleSaveAndSync = async () => {
    try {
      setIsSyncing(true);
      // Guarantee authorization directly under user click gesture before worker tasks
      if (!driveService.isConnected()) {
        await driveService.authenticate(true);
        setDriveConnected(driveService.isConnected());
      }
      const syncRes = await syncService.saveAndSync();

      if (syncRes.status === 'conflict') {
        // Show conflict resolution modal
        setConflictData(syncRes);
      } else if (syncRes.status === 'created_and_uploaded') {
        showToast('Created and uploaded ACCDB.sqlite to Google Drive!', 'success');
        await reloadData();
      } else if (syncRes.status === 'synced') {
        showToast('Database saved to OPFS & synced to Google Drive!', 'success');
        await reloadData();
      }
      setDriveConnected(driveService.isConnected());
    } catch (err) {
      showToast(`Sync failed: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
      setDriveConnected(driveService.isConnected());
    }
  };

  // Conflict Resolution: Best Effort Merge
  const handleResolveMerge = async () => {
    if (!conflictData) return;
    try {
      const res = await syncService.resolveMerge(conflictData.remoteBytes, conflictData.remoteFile.id);
      showToast('Databases merged successfully and synchronized to Google Drive!', 'success');
      await reloadData();
    } catch (err) {
      throw err;
    }
  };

  // Conflict Resolution: Keep Remote
  const handleResolveKeepRemote = async () => {
    if (!conflictData) return;
    try {
      await syncService.resolveKeepRemote(conflictData.remoteBytes, conflictData.remoteFile);
      showToast('Local database replaced with Google Drive remote copy.', 'success');
      await reloadData();
    } catch (err) {
      throw err;
    }
  };

  // Conflict Resolution: Force Overwrite
  const handleResolveForceOverwrite = async () => {
    if (!conflictData) return;
    try {
      await syncService.resolveForceOverwrite(conflictData.remoteFile.id);
      showToast('Google Drive file successfully overwritten with local database.', 'success');
      await reloadData();
    } catch (err) {
      throw err;
    }
  };

  // Daily Check: Replace local with remote
  const handleDailyReplaceWithRemote = async () => {
    try {
      await syncService.pullRemoteReplaceLocal();
      setDailyCheckData(null);
      showToast('Replaced local database with newer version from Google Drive', 'success');
      await reloadData();
    } catch (err) {
      showToast(`Failed to pull remote: ${err.message}`, 'error');
    }
  };

  // Excel Export Handler
  const handleExportExcel = async () => {
    try {
      const filename = await exportAllDataToExcel();
      showToast(`Exported all data to Excel: ${filename}`, 'success');
    } catch (err) {
      showToast(`Excel export failed: ${err.message}`, 'error');
    }
  };

  // Cross-Tab Navigations
  const handleOpenPaymentForStudent = (student) => {
    setPrefilledStudentForPayment(student);
    setActiveTab('payments');
  };

  const handleOpenSalaryForTeacher = (teacher) => {
    setPrefilledTeacherForSalary(teacher);
    setActiveTab('salaries');
  };

  const handleEditLessonFromOverview = (lesson) => {
    setEditingLessonFromOverview(lesson);
    setActiveTab('lessons');
  };

  // CRUD Handlers for entities
  const handleSaveStudent = async (studentData) => {
    await dbService.saveStudent(studentData);
    showToast(`Saved student: ${studentData.full_name}`, 'success');
    await reloadData();
  };

  const handleDeleteStudent = async (id) => {
    await dbService.deleteStudent(id);
    showToast('Student deleted', 'success');
    await reloadData();
  };

  const handleSaveTeacher = async (teacherData) => {
    await dbService.saveTeacher(teacherData);
    showToast(`Saved teacher: ${teacherData.full_name}`, 'success');
    await reloadData();
  };

  const handleDeleteTeacher = async (id) => {
    await dbService.deleteTeacher(id);
    showToast('Teacher deleted', 'success');
    await reloadData();
  };

  const handleSaveQualification = async (qualData) => {
    await dbService.saveTeacherQualification(qualData);
    showToast(`Added qualification: ${qualData.instrument}`, 'success');
    await reloadData();
  };

  const handleDeleteQualification = async (id) => {
    await dbService.deleteTeacherQualification(id);
    showToast('Removed qualification', 'success');
    await reloadData();
  };

  const handleSaveCategory = async (catData) => {
    await dbService.saveCategory(catData);
    showToast(`Saved category: ${catData.name}`, 'success');
    await reloadData();
  };

  const handleDeleteCategory = async (id) => {
    await dbService.deleteCategory(id);
    showToast('Category deleted', 'success');
    await reloadData();
  };

  const handleSaveRateTemplate = async (tplData) => {
    await dbService.saveRateTemplate(tplData);
    showToast('Rate template updated', 'success');
    await reloadData();
  };

  const handleSaveCustomizedRate = async (customData) => {
    await dbService.saveCustomizedRate(customData);
    showToast('Customized rate override saved', 'success');
    await reloadData();
  };

  const handleDeleteCustomizedRate = async (id) => {
    await dbService.deleteCustomizedRate(id);
    showToast('Customized rate deleted', 'success');
    await reloadData();
  };

  const handleSaveMonthlyLesson = async (lessonData) => {
    await dbService.saveMonthlyLesson(lessonData);
    showToast('Scheduled monthly lesson saved', 'success');
    await reloadData();
  };

  const handleDeleteMonthlyLesson = async (id) => {
    await dbService.deleteMonthlyLesson(id);
    showToast('Scheduled lesson removed', 'success');
    await reloadData();
  };

  const handleSaveAdhocLesson = async (adhocData) => {
    await dbService.saveAdhocLesson(adhocData);
    showToast('Adhoc lesson session saved', 'success');
    await reloadData();
  };

  const handleDeleteAdhocLesson = async (id) => {
    await dbService.deleteAdhocLesson(id);
    showToast('Adhoc lesson removed', 'success');
    await reloadData();
  };

  const handleSavePayment = async (paymentData) => {
    await dbService.saveStudentPayment(paymentData);
    showToast('Student fee payment recorded', 'success');
    await reloadData();
  };

  const handleDeletePayment = async (id) => {
    await dbService.deleteStudentPayment(id);
    showToast('Payment record deleted', 'success');
    await reloadData();
  };

  const handleSaveSalary = async (salaryData) => {
    await dbService.saveTeacherSalary(salaryData);
    showToast('Teacher salary payout recorded', 'success');
    await reloadData();
  };

  const handleDeleteSalary = async (id) => {
    await dbService.deleteTeacherSalary(id);
    showToast('Salary record deleted', 'success');
    await reloadData();
  };

  if (isInitializing) {
    return (
      <div className="empty-state-box" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <img 
          src="./logo.jpg" 
          alt="Music School Logo" 
          style={{ width: '80px', height: '80px', borderRadius: '16px', marginBottom: '1.5rem' }} 
        />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Initializing Music School Accounting...</h2>
        <p className="text-muted text-sm mt-2">Mounting SQLite WASM & Origin Private File System (OPFS)...</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="empty-state-box" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <h2 style={{ color: 'var(--danger)' }}>Initialization Failed</h2>
        <p className="mt-2 text-muted">{initError}</p>
        <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>
          Retry Reloading
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onSaveOPFS={handleSaveOPFS}
        onSaveAndSync={handleSaveAndSync}
        onExportExcel={handleExportExcel}
        isSaving={isSaving}
        isSyncing={isSyncing}
        driveConnected={driveConnected}
      />

      {/* Main Tab Content */}
      <main className="main-content">
        {activeTab === 'overview' && (
          <OverviewTab
            students={students}
            teachers={teachers}
            lessons={lessons}
            adhocLessons={adhocLessons}
            payments={payments}
            salaries={salaries}
            onSelectTab={setActiveTab}
            onEditLesson={handleEditLessonFromOverview}
          />
        )}

        {activeTab === 'students' && (
          <StudentsTab
            students={students}
            lessons={lessons}
            adhocLessons={adhocLessons}
            payments={payments}
            onSaveStudent={handleSaveStudent}
            onDeleteStudent={handleDeleteStudent}
            onOpenPaymentModal={handleOpenPaymentForStudent}
          />
        )}

        {activeTab === 'teachers' && (
          <TeachersTab
            teachers={teachers}
            categories={categories}
            qualifications={qualifications}
            lessons={lessons}
            salaries={salaries}
            onSaveTeacher={handleSaveTeacher}
            onDeleteTeacher={handleDeleteTeacher}
            onSaveQualification={handleSaveQualification}
            onDeleteQualification={handleDeleteQualification}
            onOpenSalaryModal={handleOpenSalaryForTeacher}
          />
        )}

        {activeTab === 'lessons' && (
          <LessonsTab
            students={students}
            teachers={teachers}
            qualifications={qualifications}
            lessons={lessons}
            adhocLessons={adhocLessons}
            onSaveMonthlyLesson={handleSaveMonthlyLesson}
            onDeleteMonthlyLesson={handleDeleteMonthlyLesson}
            onSaveAdhocLesson={handleSaveAdhocLesson}
            onDeleteAdhocLesson={handleDeleteAdhocLesson}
            editingLessonFromOverview={editingLessonFromOverview}
            onClearEditingLesson={() => setEditingLessonFromOverview(null)}
          />
        )}

        {activeTab === 'payments' && (
          <PaymentsTab
            payments={payments}
            students={students}
            lessons={lessons}
            adhocLessons={adhocLessons}
            onSavePayment={handleSavePayment}
            onDeletePayment={handleDeletePayment}
            prefilledStudent={prefilledStudentForPayment}
            onClearPrefilledStudent={() => setPrefilledStudentForPayment(null)}
          />
        )}

        {activeTab === 'salaries' && (
          <SalariesTab
            salaries={salaries}
            teachers={teachers}
            lessons={lessons}
            adhocLessons={adhocLessons}
            onSaveSalary={handleSaveSalary}
            onDeleteSalary={handleDeleteSalary}
            prefilledTeacher={prefilledTeacherForSalary}
            onClearPrefilledTeacher={() => setPrefilledTeacherForSalary(null)}
          />
        )}

        {activeTab === 'templates' && (
          <RateTemplatesTab
            categories={categories}
            rateTemplates={rateTemplates}
            customizedRates={customizedRates}
            students={students}
            teachers={teachers}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            onSaveRateTemplate={handleSaveRateTemplate}
            onSaveCustomizedRate={handleSaveCustomizedRate}
            onDeleteCustomizedRate={handleDeleteCustomizedRate}
          />
        )}

        {activeTab === 'sync' && (
          <SyncBackupTab
            onSaveOPFS={handleSaveOPFS}
            onSaveAndSync={handleSaveAndSync}
            onExportExcel={handleExportExcel}
            isSaving={isSaving}
            isSyncing={isSyncing}
            lastSaveTime={lastSaveTime}
            driveConnected={driveConnected}
            onRefreshData={reloadData}
            showToast={showToast}
          />
        )}
      </main>

      {/* Daily Freshness Check Modal (Alert on first open if Drive is newer) */}
      <DailyCheckModal
        isOpen={Boolean(dailyCheckData)}
        onClose={() => setDailyCheckData(null)}
        checkData={dailyCheckData}
        onReplaceWithRemote={handleDailyReplaceWithRemote}
      />

      {/* Conflict Resolution Modal (Out-of-sync multi-device edits) */}
      <ConflictModal
        isOpen={Boolean(conflictData)}
        onClose={() => setConflictData(null)}
        conflictData={conflictData}
        onMerge={handleResolveMerge}
        onKeepRemote={handleResolveKeepRemote}
        onForceOverwrite={handleResolveForceOverwrite}
      />

      {/* Toast Notification Stack */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
