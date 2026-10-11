// @ts-nocheck
import React, { useState } from 'react';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/currency';
import { formatDate, calculateAge, getDayName } from '../utils/dates';
import { 
  UserPlus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Award, 
  Plus, 
  Music, 
  Calendar, 
  Wallet, 
  Phone, 
  Mail, 
  AlertCircle 
} from 'lucide-react';

export default function TeachersTab({ 
  teachers = [], 
  categories = [], 
  qualifications = [], 
  lessons = [], 
  salaries = [], 
  onSaveTeacher, 
  onDeleteTeacher, 
  onSaveQualification, 
  onDeleteQualification,
  onOpenSalaryModal 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [viewingTeacher, setViewingTeacher] = useState(null);

  // Qualifications Modal State
  const [isQualModalOpen, setIsQualModalOpen] = useState(false);
  const [qualTeacher, setQualTeacher] = useState(null);
  const [qualForm, setQualForm] = useState({
    id: '',
    teacher_id: '',
    instrument: '',
    certificate: '',
    category_id: ''
  });
  const [qualError, setQualError] = useState('');

  // Teacher Form State
  const [teacherForm, setTeacherForm] = useState({
    id: '',
    ic: '',
    full_name: '',
    preferred_name: '',
    birthday: '',
    phone: '',
    email: '',
    status: 'active'
  });
  const [teacherError, setTeacherError] = useState('');

  const openCreateTeacher = () => {
    setEditingTeacher(null);
    setTeacherForm({
      id: '',
      ic: '',
      full_name: '',
      preferred_name: '',
      birthday: '',
      phone: '',
      email: '',
      status: 'active'
    });
    setTeacherError('');
    setIsTeacherModalOpen(true);
  };

  const openEditTeacher = (teacher) => {
    setEditingTeacher(teacher);
    setTeacherForm({
      id: teacher.id,
      ic: teacher.ic,
      full_name: teacher.full_name,
      preferred_name: teacher.preferred_name || '',
      birthday: teacher.birthday,
      phone: teacher.phone || '',
      email: teacher.email || '',
      status: teacher.status || 'active'
    });
    setTeacherError('');
    setIsTeacherModalOpen(true);
  };

  const handleSaveTeacherSubmit = async (e) => {
    e.preventDefault();
    if (!teacherForm.ic.trim() || !teacherForm.full_name.trim() || !teacherForm.birthday) {
      setTeacherError('IC Number, Full Name, and Birthday are required.');
      return;
    }

    const duplicate = teachers.find(
      t => t.ic.trim().toLowerCase() === teacherForm.ic.trim().toLowerCase() && t.id !== teacherForm.id
    );
    if (duplicate) {
      setTeacherError(`IC "${teacherForm.ic}" is already registered to ${duplicate.full_name}.`);
      return;
    }

    try {
      await onSaveTeacher(teacherForm);
      setIsTeacherModalOpen(false);
    } catch (err) {
      setTeacherError(err.message);
    }
  };

  const handleDeleteTeacher = async (teacher) => {
    if (window.confirm(`Delete teacher "${teacher.full_name}" (${teacher.ic}) and their qualifications?`)) {
      await onDeleteTeacher(teacher.id);
      if (viewingTeacher && viewingTeacher.id === teacher.id) {
        setViewingTeacher(null);
      }
    }
  };

  // Open Qualifications Manager for teacher
  const openQualificationsManager = (teacher) => {
    setQualTeacher(teacher);
    setQualForm({
      id: '',
      teacher_id: teacher.id,
      instrument: '',
      certificate: '',
      category_id: categories.length > 0 ? categories[0].id : ''
    });
    setQualError('');
    setIsQualModalOpen(true);
  };

  const handleSaveQualificationSubmit = async (e) => {
    e.preventDefault();
    if (!qualForm.instrument.trim() || !qualForm.certificate.trim() || !qualForm.category_id) {
      setQualError('Please fill in instrument, certificate, and select a teacher category.');
      return;
    }

    try {
      await onSaveQualification({
        ...qualForm,
        teacher_id: qualTeacher.id
      });
      // Reset form fields for adding another
      setQualForm({
        id: '',
        teacher_id: qualTeacher.id,
        instrument: '',
        certificate: '',
        category_id: categories.length > 0 ? categories[0].id : ''
      });
      setQualError('');
    } catch (err) {
      setQualError(err.message);
    }
  };

  const handleDeleteQual = async (qualId) => {
    if (window.confirm('Delete this instrument qualification?')) {
      await onDeleteQualification(qualId);
    }
  };

  // Filter teachers
  const filteredTeachers = teachers.filter(t => {
    const term = searchTerm.toLowerCase();
    return (
      t.full_name.toLowerCase().includes(term) ||
      t.ic.toLowerCase().includes(term) ||
      (t.preferred_name && t.preferred_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="tab-pane-content">
      {/* Top action bar */}
      <div className="table-action-bar">
        <div className="search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by teacher name, IC, or preferred name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={openCreateTeacher}>
          <UserPlus size={16} /> Register Teacher
        </button>
      </div>

      {/* Teachers Table */}
      <div className="table-responsive content-card mt-4">
        <table className="data-table">
          <thead>
            <tr>
              <th>Full Name / Preferred</th>
              <th>IC Number</th>
              <th>Birthday / Age</th>
              <th>Taught Instruments & Categories</th>
              <th>Weekly Slots</th>
              <th>Est. Monthly Pay</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeachers.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-muted">
                  No teachers found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredTeachers.map((teacher) => {
                const teacherQuals = qualifications.filter(q => q.teacher_id === teacher.id);
                const teacherLessons = lessons.filter(l => l.teacher_id === teacher.id && l.status === 'active');
                const monthlyPayTotal = teacherLessons.reduce((sum, l) => sum + Number(l.monthly_teacher_rate || 0), 0);

                return (
                  <tr key={teacher.id}>
                    <td>
                      <div className="font-semibold text-primary">{teacher.full_name}</div>
                      {teacher.preferred_name && (
                        <div className="text-xs text-muted">"{teacher.preferred_name}"</div>
                      )}
                    </td>
                    <td>
                      <span className="font-mono text-sm">{teacher.ic}</span>
                    </td>
                    <td>
                      <div>{formatDate(teacher.birthday)}</div>
                      <div className="text-xs text-muted">{calculateAge(teacher.birthday)}</div>
                    </td>
                    <td>
                      {teacherQuals.length === 0 ? (
                        <button 
                          className="btn btn-xs btn-outline-dashed"
                          onClick={() => openQualificationsManager(teacher)}
                        >
                          <Plus size={12} /> Add Instruments
                        </button>
                      ) : (
                        <div className="chips-container">
                          {teacherQuals.map((q) => (
                            <span 
                              key={q.id} 
                              className="chip chip-instrument clickable"
                              title={`${q.instrument} (${q.certificate}) - Category: ${q.category_name}`}
                              onClick={() => openQualificationsManager(teacher)}
                            >
                              <Music size={11} /> {q.instrument}: {q.category_name || 'Standard'}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-info">{teacherLessons.length} lessons</span>
                    </td>
                    <td>
                      <span className="font-semibold text-success">{formatCurrency(monthlyPayTotal)}/mo</span>
                    </td>
                    <td>
                      <span className={`badge ${teacher.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                        {teacher.status}
                      </span>
                    </td>
                    <td className="text-right table-actions">
                      <button 
                        className="btn-icon-subtle" 
                        title="Manage Instruments & Certificate Categories"
                        onClick={() => openQualificationsManager(teacher)}
                      >
                        <Award size={16} />
                      </button>
                      <button 
                        className="btn-icon-subtle" 
                        title="View Teacher Profile & Lessons"
                        onClick={() => setViewingTeacher(teacher)}
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        className="btn-icon-subtle" 
                        title="Edit Teacher"
                        onClick={() => openEditTeacher(teacher)}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="btn-icon-subtle text-danger" 
                        title="Delete Teacher"
                        onClick={() => handleDeleteTeacher(teacher)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Teacher Modal */}
      <Modal
        isOpen={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
        title={editingTeacher ? 'Edit Teacher Registration' : 'Register New Music Teacher'}
        maxWidth="580px"
      >
        <form onSubmit={handleSaveTeacherSubmit} className="form-layout">
          {teacherError && (
            <div className="form-alert error">
              <AlertCircle size={16} /> {teacherError}
            </div>
          )}

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">IC / National ID</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 880921-14-5123"
                required
                value={teacherForm.ic}
                onChange={(e) => setTeacherForm({ ...teacherForm, ic: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label required">Birthday</label>
              <input
                type="date"
                className="form-control"
                required
                value={teacherForm.birthday}
                onChange={(e) => setTeacherForm({ ...teacherForm, birthday: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Full Legal Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Marcus Wong"
                required
                value={teacherForm.full_name}
                onChange={(e) => setTeacherForm({ ...teacherForm, full_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Name (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Mr. Marcus"
                value={teacherForm.preferred_name}
                onChange={(e) => setTeacherForm({ ...teacherForm, preferred_name: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-control"
                placeholder="e.g. +60 16-789 1234"
                value={teacherForm.phone}
                onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="teacher@example.com"
                value={teacherForm.email}
                onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-control"
              value={teacherForm.status}
              onChange={(e) => setTeacherForm({ ...teacherForm, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="modal-actions mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setIsTeacherModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingTeacher ? 'Save Changes' : 'Register Teacher'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Qualifications & Category Assignment Modal */}
      {qualTeacher && (
        <Modal
          isOpen={isQualModalOpen}
          onClose={() => setIsQualModalOpen(false)}
          title={`Instruments & Categories: ${qualTeacher.full_name}`}
          maxWidth="640px"
        >
          <div className="quals-modal-body">
            <p className="text-sm text-muted">
              Assign music instruments taught by <strong>{qualTeacher.full_name}</strong> along with their certificate and rate category.
            </p>

            {/* Existing Qualifications Table */}
            <div className="table-responsive content-card mt-3">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Certificate</th>
                    <th>Category</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {qualifications.filter(q => q.teacher_id === qualTeacher.id).length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-4 text-muted">
                        No instruments registered for this teacher yet.
                      </td>
                    </tr>
                  ) : (
                    qualifications
                      .filter(q => q.teacher_id === qualTeacher.id)
                      .map((q) => (
                        <tr key={q.id}>
                          <td><strong>{q.instrument}</strong></td>
                          <td>{q.certificate}</td>
                          <td><span className="badge badge-category">{q.category_name || 'Assigned'}</span></td>
                          <td className="text-right">
                            <button 
                              className="btn-icon-subtle text-danger"
                              onClick={() => handleDeleteQual(q.id)}
                              title="Remove Instrument"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add New Qualification Form */}
            <form onSubmit={handleSaveQualificationSubmit} className="add-qual-form mt-4">
              <h5 className="font-semibold text-sm mb-2">Add Instrument & Category</h5>
              {qualError && <div className="form-alert error mb-2">{qualError}</div>}

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label required">Instrument</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Piano, Violin"
                    required
                    value={qualForm.instrument}
                    onChange={(e) => setQualForm({ ...qualForm, instrument: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">Certificate</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Trinity ATCL, ABRSM 8"
                    required
                    value={qualForm.certificate}
                    onChange={(e) => setQualForm({ ...qualForm, certificate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">Teacher Category</label>
                  <select
                    className="form-control"
                    required
                    value={qualForm.category_id}
                    onChange={(e) => setQualForm({ ...qualForm, category_id: e.target.value })}
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.instrument})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-sm btn-primary mt-2">
                <Plus size={14} /> Add Instrument Qualification
              </button>
            </form>
          </div>
        </Modal>
      )}

      {/* Teacher Profile Overview Modal */}
      {viewingTeacher && (
        <Modal
          isOpen={Boolean(viewingTeacher)}
          onClose={() => setViewingTeacher(null)}
          title={`Teacher Profile: ${viewingTeacher.full_name}`}
          maxWidth="700px"
        >
          <div className="student-profile-body">
            <div className="profile-banner">
              <div>
                <h4 className="profile-name">{viewingTeacher.full_name}</h4>
                {viewingTeacher.preferred_name && (
                  <p className="profile-preferred">Preferred: "{viewingTeacher.preferred_name}"</p>
                )}
                <div className="profile-chips mt-2">
                  <span className="badge badge-mono">IC: {viewingTeacher.ic}</span>
                  <span className="badge badge-info">Birthday: {formatDate(viewingTeacher.birthday)} ({calculateAge(viewingTeacher.birthday)})</span>
                  <span className={`badge ${viewingTeacher.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                    {viewingTeacher.status}
                  </span>
                </div>
              </div>
              <button 
                className="btn btn-sm btn-accent"
                onClick={() => {
                  const t = viewingTeacher;
                  setViewingTeacher(null);
                  onOpenSalaryModal(t);
                }}
              >
                <Wallet size={14} /> Record Salary Payout
              </button>
            </div>

            {/* Weekly Scheduled Lessons */}
            <div className="profile-section mt-4">
              <h5 className="section-subtitle">
                <Calendar size={16} /> Scheduled Recurring Lessons
              </h5>
              {lessons.filter(l => l.teacher_id === viewingTeacher.id && l.status === 'active').length === 0 ? (
                <p className="text-muted text-sm">No scheduled lessons assigned to this teacher.</p>
              ) : (
                <div className="list-group mt-2">
                  {lessons
                    .filter(l => l.teacher_id === viewingTeacher.id && l.status === 'active')
                    .map((l) => (
                      <div key={l.id} className="list-item-row">
                        <div>
                          <strong>Student: {l.student_name}</strong> ({l.instrument} - {l.grade})
                          <div className="text-xs text-muted">
                            Every {getDayName(l.day_of_week)} at {l.start_time} ({l.duration_minutes}m)
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-success">{formatCurrency(l.monthly_teacher_rate)}/mo</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Salary History */}
            <div className="profile-section mt-4">
              <h5 className="section-subtitle">
                <Wallet size={16} /> Salary Payout History
              </h5>
              {salaries.filter(s => s.teacher_id === viewingTeacher.id).length === 0 ? (
                <p className="text-muted text-sm">No salary payout records recorded.</p>
              ) : (
                <div className="list-group mt-2">
                  {salaries
                    .filter(s => s.teacher_id === viewingTeacher.id)
                    .map((s) => (
                      <div key={s.id} className="list-item-row">
                        <div>
                          <strong>{formatCurrency(s.amount_paid)}</strong> - {s.salary_type}
                          <div className="text-xs text-muted">
                            {formatDate(s.payout_date)} • Period: {s.period} • {s.payment_method}
                          </div>
                        </div>
                        <div className="text-right">
                          {s.voucher_no && <span className="badge badge-mono">Voucher: {s.voucher_no}</span>}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
