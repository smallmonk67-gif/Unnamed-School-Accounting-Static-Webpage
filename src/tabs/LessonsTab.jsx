import React, { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/currency';
import { DAYS_OF_WEEK, getDayName, formatDate, getTodayDate } from '../utils/dates';
import { dbService } from '../services/dbService';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Music, 
  User, 
  CheckCircle, 
  AlertCircle,
  Sparkles
} from 'lucide-react';

export default function LessonsTab({ 
  students = [], 
  teachers = [], 
  qualifications = [], 
  lessons = [], 
  adhocLessons = [], 
  onSaveMonthlyLesson, 
  onDeleteMonthlyLesson, 
  onSaveAdhocLesson, 
  onDeleteAdhocLesson,
  editingLessonFromOverview,
  onClearEditingLesson 
}) {
  const [subTab, setSubTab] = useState('monthly'); // 'monthly' or 'adhoc'
  const [searchTerm, setSearchTerm] = useState('');

  // Monthly Lesson Modal State
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);
  const [editingMonthlyLesson, setEditingMonthlyLesson] = useState(null);
  const [monthlyForm, setMonthlyForm] = useState({
    id: '',
    student_id: '',
    teacher_id: '',
    instrument: '',
    grade: 'Grade 1',
    day_of_week: 1,
    start_time: '15:00',
    duration_minutes: 45,
    monthly_student_fee: 170,
    monthly_teacher_rate: 100,
    is_custom_rate: 0,
    customized_rate_id: null,
    start_date: getTodayDate(),
    end_date: '',
    status: 'active'
  });
  const [resolvedRateInfo, setResolvedRateInfo] = useState('');
  const [monthlyError, setMonthlyError] = useState('');

  // Adhoc Lesson Modal State
  const [isAdhocModalOpen, setIsAdhocModalOpen] = useState(false);
  const [editingAdhocLesson, setEditingAdhocLesson] = useState(null);
  const [adhocForm, setAdhocForm] = useState({
    id: '',
    student_id: '',
    teacher_id: '',
    instrument: '',
    lesson_date: getTodayDate(),
    start_time: '14:00',
    duration_minutes: 45,
    student_fee: 50,
    teacher_pay: 30,
    status: 'scheduled',
    notes: ''
  });
  const [adhocError, setAdhocError] = useState('');

  // Handle external edit trigger from overview timetable
  useEffect(() => {
    if (editingLessonFromOverview) {
      openEditMonthlyLesson(editingLessonFromOverview);
      onClearEditingLesson();
    }
  }, [editingLessonFromOverview]);

  // Open Create Monthly
  const openCreateMonthlyLesson = () => {
    setEditingMonthlyLesson(null);
    const initialStudentId = students.length > 0 ? students[0].id : '';
    const initialTeacherId = teachers.length > 0 ? teachers[0].id : '';
    const teacherQuals = qualifications.filter(q => q.teacher_id === initialTeacherId);
    const initialInstrument = teacherQuals.length > 0 ? teacherQuals[0].instrument : 'Piano';

    setMonthlyForm({
      id: '',
      student_id: initialStudentId,
      teacher_id: initialTeacherId,
      instrument: initialInstrument,
      grade: 'Grade 1',
      day_of_week: 1,
      start_time: '15:00',
      duration_minutes: 45,
      monthly_student_fee: 170,
      monthly_teacher_rate: 100,
      is_custom_rate: 0,
      customized_rate_id: null,
      start_date: getTodayDate(),
      end_date: '',
      status: 'active'
    });
    setMonthlyError('');
    setIsMonthlyModalOpen(true);
    triggerAutoRateLookup(initialStudentId, initialTeacherId, initialInstrument, 'Grade 1', 45);
  };

  // Open Edit Monthly
  const openEditMonthlyLesson = (lesson) => {
    setEditingMonthlyLesson(lesson);
    setMonthlyForm({
      id: lesson.id,
      student_id: lesson.student_id,
      teacher_id: lesson.teacher_id,
      instrument: lesson.instrument,
      grade: lesson.grade,
      day_of_week: Number(lesson.day_of_week),
      start_time: lesson.start_time,
      duration_minutes: Number(lesson.duration_minutes),
      monthly_student_fee: Number(lesson.monthly_student_fee),
      monthly_teacher_rate: Number(lesson.monthly_teacher_rate),
      is_custom_rate: Number(lesson.is_custom_rate),
      customized_rate_id: lesson.customized_rate_id || null,
      start_date: lesson.start_date,
      end_date: lesson.end_date || '',
      status: lesson.status || 'active'
    });
    setResolvedRateInfo(lesson.is_custom_rate ? 'Custom Rate Applied' : 'Standard Template Rate');
    setMonthlyError('');
    setIsMonthlyModalOpen(true);
  };

  // Auto lookup rate from template / custom
  const triggerAutoRateLookup = async (studentId, teacherId, instrument, grade, duration) => {
    if (!studentId || !teacherId || !instrument || !grade || !duration) return;
    try {
      const rateResult = await dbService.lookupLessonRate({
        studentId,
        teacherId,
        instrument,
        grade,
        durationMinutes: duration
      });

      if (!monthlyForm.is_custom_rate) {
        setMonthlyForm((prev) => ({
          ...prev,
          monthly_student_fee: rateResult.studentFee,
          monthly_teacher_rate: rateResult.teacherRate,
          is_custom_rate: rateResult.isCustom ? 1 : 0,
          customized_rate_id: rateResult.customRateId || null
        }));
      }
      setResolvedRateInfo(rateResult.source);
    } catch (err) {
      console.warn('Auto rate lookup error:', err);
    }
  };

  const handleMonthlySubmit = async (e) => {
    e.preventDefault();
    if (!monthlyForm.student_id || !monthlyForm.teacher_id || !monthlyForm.instrument) {
      setMonthlyError('Please select student, teacher, and instrument.');
      return;
    }

    try {
      await onSaveMonthlyLesson(monthlyForm);
      setIsMonthlyModalOpen(false);
    } catch (err) {
      setMonthlyError(err.message);
    }
  };

  const handleDeleteMonthly = async (lesson) => {
    if (window.confirm(`Delete scheduled weekly lesson for ${lesson.student_name} (${lesson.instrument})?`)) {
      await onDeleteMonthlyLesson(lesson.id);
    }
  };

  // Open Create Adhoc
  const openCreateAdhoc = () => {
    setEditingAdhocLesson(null);
    const initialStudentId = students.length > 0 ? students[0].id : '';
    const initialTeacherId = teachers.length > 0 ? teachers[0].id : '';
    const teacherQuals = qualifications.filter(q => q.teacher_id === initialTeacherId);
    const initialInstrument = teacherQuals.length > 0 ? teacherQuals[0].instrument : 'Piano';

    setAdhocForm({
      id: '',
      student_id: initialStudentId,
      teacher_id: initialTeacherId,
      instrument: initialInstrument,
      lesson_date: getTodayDate(),
      start_time: '14:00',
      duration_minutes: 45,
      student_fee: 55,
      teacher_pay: 35,
      status: 'scheduled',
      notes: ''
    });
    setAdhocError('');
    setIsAdhocModalOpen(true);
  };

  const openEditAdhoc = (adhoc) => {
    setEditingAdhocLesson(adhoc);
    setAdhocForm({
      id: adhoc.id,
      student_id: adhoc.student_id,
      teacher_id: adhoc.teacher_id,
      instrument: adhoc.instrument,
      lesson_date: adhoc.lesson_date,
      start_time: adhoc.start_time,
      duration_minutes: Number(adhoc.duration_minutes),
      student_fee: Number(adhoc.student_fee),
      teacher_pay: Number(adhoc.teacher_pay),
      status: adhoc.status || 'scheduled',
      notes: adhoc.notes || ''
    });
    setAdhocError('');
    setIsAdhocModalOpen(true);
  };

  const handleAdhocSubmit = async (e) => {
    e.preventDefault();
    if (!adhocForm.student_id || !adhocForm.teacher_id || !adhocForm.instrument || !adhocForm.lesson_date) {
      setAdhocError('Please fill in student, teacher, instrument, and session date.');
      return;
    }

    try {
      await onSaveAdhocLesson(adhocForm);
      setIsAdhocModalOpen(false);
    } catch (err) {
      setAdhocError(err.message);
    }
  };

  const handleDeleteAdhoc = async (adhoc) => {
    if (window.confirm(`Delete adhoc lesson on ${adhoc.lesson_date} for ${adhoc.student_name}?`)) {
      await onDeleteAdhocLesson(adhoc.id);
    }
  };

  // Get instruments for currently selected teacher in monthly modal
  const selectedTeacherQuals = qualifications.filter(q => q.teacher_id === monthlyForm.teacher_id);
  const teacherInstruments = Array.from(new Set(selectedTeacherQuals.map(q => q.instrument)));
  if (teacherInstruments.length === 0) {
    teacherInstruments.push('Piano', 'Violin', 'Guitar', 'Vocal', 'Drums');
  }

  // Filter lists
  const filteredMonthly = lessons.filter(l => {
    const term = searchTerm.toLowerCase();
    return (
      l.student_name.toLowerCase().includes(term) ||
      l.teacher_name.toLowerCase().includes(term) ||
      l.instrument.toLowerCase().includes(term) ||
      l.student_ic.toLowerCase().includes(term)
    );
  });

  const filteredAdhoc = adhocLessons.filter(a => {
    const term = searchTerm.toLowerCase();
    return (
      a.student_name.toLowerCase().includes(term) ||
      a.teacher_name.toLowerCase().includes(term) ||
      a.instrument.toLowerCase().includes(term) ||
      a.lesson_date.includes(term)
    );
  });

  const gradesList = [
    'Beginner', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 
    'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Diploma'
  ];

  return (
    <div className="tab-pane-content">
      {/* Subtab navigation */}
      <div className="subnav-container">
        <button 
          className={`subnav-btn ${subTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setSubTab('monthly')}
        >
          <Calendar size={16} /> Monthly Recurring Lessons ({lessons.length})
        </button>
        <button 
          className={`subnav-btn ${subTab === 'adhoc' ? 'active' : ''}`}
          onClick={() => setSubTab('adhoc')}
        >
          <Clock size={16} /> Adhoc Lesson Sessions ({adhocLessons.length})
        </button>
      </div>

      {/* Action Bar */}
      <div className="table-action-bar mt-4">
        <div className="search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={subTab === 'monthly' ? 'Search weekly lessons by student, teacher, or instrument...' : 'Search adhoc sessions...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {subTab === 'monthly' ? (
          <button className="btn btn-primary" onClick={openCreateMonthlyLesson}>
            <Plus size={16} /> Schedule Monthly Lesson
          </button>
        ) : (
          <button className="btn btn-primary" onClick={openCreateAdhoc}>
            <Plus size={16} /> Schedule Adhoc Session
          </button>
        )}
      </div>

      {/* Subtab 1: Monthly Scheduled Lessons Table */}
      {subTab === 'monthly' && (
        <div className="table-responsive content-card mt-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Teacher</th>
                <th>Instrument & Grade</th>
                <th>Weekly Slot</th>
                <th>Duration</th>
                <th>Monthly Student Fee</th>
                <th>Monthly Teacher Pay</th>
                <th>Rate Type</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMonthly.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-8 text-muted">
                    No monthly recurring lessons scheduled.
                  </td>
                </tr>
              ) : (
                filteredMonthly.map((lesson) => (
                  <tr key={lesson.id}>
                    <td>
                      <div className="font-semibold text-primary">{lesson.student_name}</div>
                      <div className="text-xs text-muted font-mono">{lesson.student_ic}</div>
                    </td>
                    <td>
                      <div>{lesson.teacher_name}</div>
                      <div className="text-xs text-muted font-mono">{lesson.teacher_ic}</div>
                    </td>
                    <td>
                      <span className="chip chip-instrument">
                        <Music size={12} /> {lesson.instrument}
                      </span>
                      <span className="badge badge-grade ml-1">{lesson.grade}</span>
                    </td>
                    <td>
                      <span className="font-medium text-dark">
                        {getDayName(lesson.day_of_week)} at {lesson.start_time}
                      </span>
                    </td>
                    <td>{lesson.duration_minutes} mins</td>
                    <td>
                      <strong className="text-primary">{formatCurrency(lesson.monthly_student_fee)}/mo</strong>
                    </td>
                    <td>
                      <strong className="text-success">{formatCurrency(lesson.monthly_teacher_rate)}/mo</strong>
                    </td>
                    <td>
                      {Boolean(lesson.is_custom_rate) ? (
                        <span className="badge badge-warning" title="Custom override for this student/teacher">
                          Custom Override
                        </span>
                      ) : (
                        <span className="badge badge-success" title="Defaulted to teacher category rate template">
                          Template Rate
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${lesson.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                        {lesson.status}
                      </span>
                    </td>
                    <td className="text-right table-actions">
                      <button 
                        className="btn-icon-subtle" 
                        title="Modify Lesson Slot & Fee"
                        onClick={() => openEditMonthlyLesson(lesson)}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="btn-icon-subtle text-danger" 
                        title="Delete Lesson Slot"
                        onClick={() => handleDeleteMonthly(lesson)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Subtab 2: Adhoc Lessons Table */}
      {subTab === 'adhoc' && (
        <div className="table-responsive content-card mt-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Session Date & Time</th>
                <th>Student</th>
                <th>Teacher</th>
                <th>Instrument</th>
                <th>Duration</th>
                <th>Student Fee</th>
                <th>Teacher Pay</th>
                <th>Status</th>
                <th>Notes</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdhoc.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-8 text-muted">
                    No adhoc lesson sessions scheduled yet.
                  </td>
                </tr>
              ) : (
                filteredAdhoc.map((adhoc) => (
                  <tr key={adhoc.id}>
                    <td>
                      <div className="font-semibold text-dark">{formatDate(adhoc.lesson_date)}</div>
                      <div className="text-xs text-muted"><Clock size={12} className="inline mr-1" />{adhoc.start_time}</div>
                    </td>
                    <td>
                      <div className="font-semibold text-primary">{adhoc.student_name}</div>
                      <div className="text-xs text-muted font-mono">{adhoc.student_ic}</div>
                    </td>
                    <td>
                      <div>{adhoc.teacher_name}</div>
                    </td>
                    <td>
                      <span className="chip chip-instrument">
                        <Music size={12} /> {adhoc.instrument}
                      </span>
                    </td>
                    <td>{adhoc.duration_minutes} mins</td>
                    <td>
                      <strong className="text-primary">{formatCurrency(adhoc.student_fee)}</strong>
                    </td>
                    <td>
                      <strong className="text-success">{formatCurrency(adhoc.teacher_pay)}</strong>
                    </td>
                    <td>
                      <span className={`badge ${
                        adhoc.status === 'completed' ? 'badge-success' : 
                        adhoc.status === 'cancelled' ? 'badge-danger' : 'badge-info'
                      }`}>
                        {adhoc.status}
                      </span>
                    </td>
                    <td className="text-sm text-muted">{adhoc.notes || '-'}</td>
                    <td className="text-right table-actions">
                      <button 
                        className="btn-icon-subtle" 
                        title="Edit Adhoc Session"
                        onClick={() => openEditAdhoc(adhoc)}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="btn-icon-subtle text-danger" 
                        title="Delete Adhoc Session"
                        onClick={() => handleDeleteAdhoc(adhoc)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Monthly Lesson Modal */}
      <Modal
        isOpen={isMonthlyModalOpen}
        onClose={() => setIsMonthlyModalOpen(false)}
        title={editingMonthlyLesson ? 'Modify Scheduled Monthly Lesson' : 'Schedule Monthly Recurring Lesson'}
        maxWidth="680px"
      >
        <form onSubmit={handleMonthlySubmit} className="form-layout">
          {monthlyError && (
            <div className="form-alert error">
              <AlertCircle size={16} /> {monthlyError}
            </div>
          )}

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Student</label>
              <select
                className="form-control"
                required
                value={monthlyForm.student_id}
                onChange={(e) => {
                  const sId = e.target.value;
                  setMonthlyForm({ ...monthlyForm, student_id: sId });
                  triggerAutoRateLookup(sId, monthlyForm.teacher_id, monthlyForm.instrument, monthlyForm.grade, monthlyForm.duration_minutes);
                }}
              >
                <option value="">-- Select Student --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.ic})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Teacher</label>
              <select
                className="form-control"
                required
                value={monthlyForm.teacher_id}
                onChange={(e) => {
                  const tId = e.target.value;
                  const tQuals = qualifications.filter(q => q.teacher_id === tId);
                  const newInst = tQuals.length > 0 ? tQuals[0].instrument : monthlyForm.instrument;
                  setMonthlyForm({ ...monthlyForm, teacher_id: tId, instrument: newInst });
                  triggerAutoRateLookup(monthlyForm.student_id, tId, newInst, monthlyForm.grade, monthlyForm.duration_minutes);
                }}
              >
                <option value="">-- Select Teacher --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.ic})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label required">Music Instrument</label>
              <select
                className="form-control"
                required
                value={monthlyForm.instrument}
                onChange={(e) => {
                  const inst = e.target.value;
                  setMonthlyForm({ ...monthlyForm, instrument: inst });
                  triggerAutoRateLookup(monthlyForm.student_id, monthlyForm.teacher_id, inst, monthlyForm.grade, monthlyForm.duration_minutes);
                }}
              >
                {teacherInstruments.map((inst) => (
                  <option key={inst} value={inst}>{inst}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Lesson Grade</label>
              <select
                className="form-control"
                required
                value={monthlyForm.grade}
                onChange={(e) => {
                  const gr = e.target.value;
                  setMonthlyForm({ ...monthlyForm, grade: gr });
                  triggerAutoRateLookup(monthlyForm.student_id, monthlyForm.teacher_id, monthlyForm.instrument, gr, monthlyForm.duration_minutes);
                }}
              >
                {gradesList.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Duration</label>
              <select
                className="form-control"
                required
                value={monthlyForm.duration_minutes}
                onChange={(e) => {
                  const dur = Number(e.target.value);
                  setMonthlyForm({ ...monthlyForm, duration_minutes: dur });
                  triggerAutoRateLookup(monthlyForm.student_id, monthlyForm.teacher_id, monthlyForm.instrument, monthlyForm.grade, dur);
                }}
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Weekly Day of Week</label>
              <select
                className="form-control"
                required
                value={monthlyForm.day_of_week}
                onChange={(e) => setMonthlyForm({ ...monthlyForm, day_of_week: Number(e.target.value) })}
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Weekly Start Time</label>
              <input
                type="time"
                className="form-control"
                required
                value={monthlyForm.start_time}
                onChange={(e) => setMonthlyForm({ ...monthlyForm, start_time: e.target.value })}
              />
            </div>
          </div>

          {/* Rate Pricing Section */}
          <div className="rate-resolver-box">
            <div className="rate-resolver-header">
              <span className="font-semibold text-sm">
                <Sparkles size={14} className="inline mr-1 text-primary" /> Monthly Lesson Pricing
              </span>
              {resolvedRateInfo && (
                <span className="badge badge-info">{resolvedRateInfo}</span>
              )}
            </div>

            <div className="form-row-2 mt-2">
              <div className="form-group">
                <label className="form-label required">Monthly Student Fee ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  required
                  value={monthlyForm.monthly_student_fee}
                  onChange={(e) => setMonthlyForm({ 
                    ...monthlyForm, 
                    monthly_student_fee: e.target.value,
                    is_custom_rate: 1 
                  })}
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Monthly Teacher Pay ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  required
                  value={monthlyForm.monthly_teacher_rate}
                  onChange={(e) => setMonthlyForm({ 
                    ...monthlyForm, 
                    monthly_teacher_rate: e.target.value,
                    is_custom_rate: 1 
                  })}
                />
              </div>
            </div>

            <div className="form-checkbox-wrap mt-2">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(monthlyForm.is_custom_rate)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setMonthlyForm({ ...monthlyForm, is_custom_rate: checked ? 1 : 0 });
                    if (!checked) {
                      triggerAutoRateLookup(
                        monthlyForm.student_id, 
                        monthlyForm.teacher_id, 
                        monthlyForm.instrument, 
                        monthlyForm.grade, 
                        monthlyForm.duration_minutes
                      );
                    }
                  }}
                />
                Mark as Customized Rate Override (Special agreement for this student)
              </label>
            </div>
          </div>

          <div className="form-row-2 mt-3">
            <div className="form-group">
              <label className="form-label required">Start Date</label>
              <input
                type="date"
                className="form-control"
                required
                value={monthlyForm.start_date}
                onChange={(e) => setMonthlyForm({ ...monthlyForm, start_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-control"
                value={monthlyForm.status}
                onChange={(e) => setMonthlyForm({ ...monthlyForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="modal-actions mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setIsMonthlyModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingMonthlyLesson ? 'Save Changes' : 'Schedule Lesson'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Adhoc Lesson Modal */}
      <Modal
        isOpen={isAdhocModalOpen}
        onClose={() => setIsAdhocModalOpen(false)}
        title={editingAdhocLesson ? 'Edit Adhoc Session' : 'Schedule One-off Adhoc Lesson'}
        maxWidth="600px"
      >
        <form onSubmit={handleAdhocSubmit} className="form-layout">
          {adhocError && (
            <div className="form-alert error">
              <AlertCircle size={16} /> {adhocError}
            </div>
          )}

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Student</label>
              <select
                className="form-control"
                required
                value={adhocForm.student_id}
                onChange={(e) => setAdhocForm({ ...adhocForm, student_id: e.target.value })}
              >
                <option value="">-- Select Student --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.ic})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Teacher</label>
              <select
                className="form-control"
                required
                value={adhocForm.teacher_id}
                onChange={(e) => setAdhocForm({ ...adhocForm, teacher_id: e.target.value })}
              >
                <option value="">-- Select Teacher --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.ic})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Music Instrument</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Piano, Cello, Vocal"
                required
                value={adhocForm.instrument}
                onChange={(e) => setAdhocForm({ ...adhocForm, instrument: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Duration (Minutes)</label>
              <input
                type="number"
                min="15"
                step="5"
                className="form-control"
                required
                value={adhocForm.duration_minutes}
                onChange={(e) => setAdhocForm({ ...adhocForm, duration_minutes: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Session Date</label>
              <input
                type="date"
                className="form-control"
                required
                value={adhocForm.lesson_date}
                onChange={(e) => setAdhocForm({ ...adhocForm, lesson_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Start Time</label>
              <input
                type="time"
                className="form-control"
                required
                value={adhocForm.start_time}
                onChange={(e) => setAdhocForm({ ...adhocForm, start_time: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Student Fee for Session ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                required
                value={adhocForm.student_fee}
                onChange={(e) => setAdhocForm({ ...adhocForm, student_fee: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Teacher Pay for Session ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                required
                value={adhocForm.teacher_pay}
                onChange={(e) => setAdhocForm({ ...adhocForm, teacher_pay: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-control"
                value={adhocForm.status}
                onChange={(e) => setAdhocForm({ ...adhocForm, status: e.target.value })}
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Exam trial session"
                value={adhocForm.notes}
                onChange={(e) => setAdhocForm({ ...adhocForm, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-actions mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setIsAdhocModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingAdhocLesson ? 'Save Changes' : 'Schedule Adhoc Session'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
