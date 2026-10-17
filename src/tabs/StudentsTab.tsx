// @ts-nocheck
import React, { useState } from 'react';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/currency';
import { formatDate, calculateAge, getTodayDate, getDayName } from '../utils/dates';
import { 
  UserPlus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Calendar, 
  CreditCard, 
  Phone, 
  Mail, 
  AlertCircle 
} from 'lucide-react';

export default function StudentsTab({ 
  students = [], 
  lessons = [], 
  adhocLessons = [], 
  payments = [], 
  onSaveStudent, 
  onDeleteStudent,
  onOpenPaymentModal 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [viewingStudent, setViewingStudent] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    ic: '',
    full_name: '',
    preferred_name: '',
    birthday: '',
    phone: '',
    email: '',
    emergency_contact: '',
    status: 'active'
  });
  const [touchedFields, setTouchedFields] = useState({});
  const [formError, setFormError] = useState('');

  const openCreateModal = () => {
    setEditingStudent(null);
    setFormData({
      id: '',
      ic: '',
      full_name: '',
      preferred_name: '',
      birthday: '',
      phone: '',
      email: '',
      emergency_contact: '',
      status: 'active'
    });
    setFormError('');
    setTouchedFields({});
    setIsModalOpen(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setFormData({
      id: student.id,
      ic: student.ic,
      full_name: student.full_name,
      preferred_name: student.preferred_name || '',
      birthday: student.birthday,
      phone: student.phone || '',
      email: student.email || '',
      emergency_contact: student.emergency_contact || '',
      status: student.status || 'active'
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ic.trim() || !formData.full_name.trim() || !formData.birthday) {
      setFormError('IC Number, Full Name, and Birthday are required.');
      return;
    }

    // Check duplicate IC (except for currently editing student)
    const duplicate = students.find(
      s => s.ic.trim().toLowerCase() === formData.ic.trim().toLowerCase() && s.id !== formData.id
    );
    if (duplicate) {
      setFormError(`IC "${formData.ic}" is already registered to ${duplicate.full_name}.`);
      return;
    }

    try {
      await onSaveStudent(formData);
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDelete = async (student) => {
    if (window.confirm(`Are you sure you want to delete student "${student.full_name}" (${student.ic})?`)) {
      await onDeleteStudent(student.id);
      if (viewingStudent && viewingStudent.id === student.id) {
        setViewingStudent(null);
      }
    }
  };

  // Filter students
  const filteredStudents = students.filter(s => {
    const term = searchTerm.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(term) ||
      s.ic.toLowerCase().includes(term) ||
      (s.preferred_name && s.preferred_name.toLowerCase().includes(term))
    );
  });

  // WebRTC Merge Effect for formData
  React.useEffect(() => {
    if (isModalOpen && editingStudent) {
      const updatedItem = students.find(item => item.id === editingStudent.id);
      if (updatedItem) {
        setFormData(prev => {
          const newData = { ...prev };
          let hasChanges = false;
          const fields = ["ic","full_name","preferred_name","birthday","phone","email","emergency_contact","status"];
          for (const field of fields) {
            if (!touchedFields[field] && updatedItem[field] !== undefined && updatedItem[field] !== null) {
              const remoteValue = updatedItem[field];
              if (newData[field] !== remoteValue) {
                newData[field] = remoteValue;
                hasChanges = true;
              }
            }
          }
          return hasChanges ? newData : prev;
        });
      }
    }
  }, [students, isModalOpen, editingStudent, touchedFields]);

  return (
    <div className="tab-pane-content">
      {/* Top action bar */}
      <div className="table-action-bar">
        <div className="search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by student name, IC, or preferred name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <UserPlus size={16} /> Register Student
        </button>
      </div>

      {/* Students Table */}
      <div className="table-responsive content-card mt-4">
        <table className="data-table">
          <thead>
            <tr>
              <th>Full Name / Preferred</th>
              <th>IC Number</th>
              <th>Birthday / Age</th>
              <th>Contact Info</th>
              <th>Active Lessons</th>
              <th>Monthly Fee</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-muted">
                  No students found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => {
                const studentLessons = lessons.filter(l => l.student_id === student.id && l.status === 'active');
                const monthlyFeeTotal = studentLessons.reduce((sum, l) => sum + Number(l.monthly_student_fee || 0), 0);

                return (
                  <tr key={student.id}>
                    <td>
                      <div className="font-semibold text-primary">{student.full_name}</div>
                      {student.preferred_name && (
                        <div className="text-xs text-muted">"{student.preferred_name}"</div>
                      )}
                    </td>
                    <td>
                      <span className="font-mono text-sm">{student.ic}</span>
                    </td>
                    <td>
                      <div>{formatDate(student.birthday)}</div>
                      <div className="text-xs text-muted">{calculateAge(student.birthday)}</div>
                    </td>
                    <td>
                      {student.phone && <div className="text-sm"><Phone size={12} className="inline mr-1" />{student.phone}</div>}
                      {student.email && <div className="text-xs text-muted"><Mail size={12} className="inline mr-1" />{student.email}</div>}
                      {!student.phone && !student.email && <span className="text-muted">-</span>}
                    </td>
                    <td>
                      <span className="badge badge-info">{studentLessons.length} recurring</span>
                    </td>
                    <td>
                      <span className="font-medium">{formatCurrency(monthlyFeeTotal)}/mo</span>
                    </td>
                    <td>
                      <span className={`badge ${student.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="text-right table-actions">
                      <button 
                        className="btn-icon-subtle" 
                        title="View Student Details & Account"
                        onClick={() => setViewingStudent(student)}
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        className="btn-icon-subtle" 
                        title="Edit Student"
                        onClick={() => openEditModal(student)}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="btn-icon-subtle text-danger" 
                        title="Delete Student"
                        onClick={() => handleDelete(student)}
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

      {/* Add / Edit Student Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStudent ? 'Edit Student Registration' : 'Register New Student'}
        maxWidth="580px"
      >
        <form onSubmit={handleSubmit} className="form-layout">
          {formError && (
            <div className="form-alert error">
              <AlertCircle size={16} /> {formError}
            </div>
          )}

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">IC / National ID</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 050312-10-5432"
                required
                value={formData.ic}
                onChange={(e) => handleFieldChange('ic', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label required">Birthday</label>
              <input
                type="date"
                className="form-control"
                required
                value={formData.birthday}
                onChange={(e) => handleFieldChange('birthday', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Full Legal Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Tan Mei Ling"
                required
                value={formData.full_name}
                onChange={(e) => handleFieldChange('full_name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Name (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. May Tan"
                value={formData.preferred_name}
                onChange={(e) => handleFieldChange('preferred_name', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-control"
                placeholder="e.g. +60 12-345 6789"
                value={formData.phone}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="student@example.com"
                value={formData.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Emergency Contact / Parent</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Mother: 012-9876543"
                value={formData.emergency_contact}
                onChange={(e) => handleFieldChange('emergency_contact', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => handleFieldChange('status', e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="modal-actions mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingStudent ? 'Save Changes' : 'Register Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Student Details & Account Overview Drawer / Modal */}
      {viewingStudent && (
        <Modal
          isOpen={Boolean(viewingStudent)}
          onClose={() => setViewingStudent(null)}
          title={`Student Profile: ${viewingStudent.full_name}`}
          maxWidth="700px"
        >
          <div className="student-profile-body">
            <div className="profile-banner">
              <div>
                <h4 className="profile-name">{viewingStudent.full_name}</h4>
                {viewingStudent.preferred_name && (
                  <p className="profile-preferred">Preferred: "{viewingStudent.preferred_name}"</p>
                )}
                <div className="profile-chips mt-2">
                  <span className="badge badge-mono">IC: {viewingStudent.ic}</span>
                  <span className="badge badge-info">Birthday: {formatDate(viewingStudent.birthday)} ({calculateAge(viewingStudent.birthday)})</span>
                  <span className={`badge ${viewingStudent.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                    {viewingStudent.status}
                  </span>
                </div>
              </div>
              <button 
                className="btn btn-sm btn-accent"
                onClick={() => {
                  const s = viewingStudent;
                  setViewingStudent(null);
                  onOpenPaymentModal(s);
                }}
              >
                <CreditCard size={14} /> Record Fee Payment
              </button>
            </div>

            {/* Enrolled Monthly Lessons */}
            <div className="profile-section mt-4">
              <h5 className="section-subtitle">
                <Calendar size={16} /> Enrolled Weekly Lessons (Recurring)
              </h5>
              {lessons.filter(l => l.student_id === viewingStudent.id && l.status === 'active').length === 0 ? (
                <p className="text-muted text-sm">No active recurring lessons assigned.</p>
              ) : (
                <div className="list-group mt-2">
                  {lessons
                    .filter(l => l.student_id === viewingStudent.id && l.status === 'active')
                    .map((l) => (
                      <div key={l.id} className="list-item-row">
                        <div>
                          <strong>{l.instrument} ({l.grade})</strong> with Teacher {l.teacher_name}
                          <div className="text-xs text-muted">
                            Every {getDayName(l.day_of_week)} at {l.start_time} ({l.duration_minutes}m)
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-primary">{formatCurrency(l.monthly_student_fee)}/mo</span>
                          {Boolean(l.is_custom_rate) && (
                            <div className="text-xs text-orange">Custom Override</div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Adhoc Lessons History */}
            <div className="profile-section mt-4">
              <h5 className="section-subtitle">Adhoc Lesson Sessions</h5>
              {adhocLessons.filter(a => a.student_id === viewingStudent.id).length === 0 ? (
                <p className="text-muted text-sm">No adhoc lesson sessions recorded.</p>
              ) : (
                <div className="list-group mt-2">
                  {adhocLessons
                    .filter(a => a.student_id === viewingStudent.id)
                    .map((a) => (
                      <div key={a.id} className="list-item-row">
                        <div>
                          <strong>{a.instrument}</strong> on {formatDate(a.lesson_date)} at {a.start_time}
                          <div className="text-xs text-muted">Teacher: {a.teacher_name} ({a.duration_minutes}m)</div>
                        </div>
                        <div className="text-right">
                          <span className="badge badge-info">{formatCurrency(a.student_fee)}</span>
                          <span className="badge badge-muted ml-1">{a.status}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Payment Receipts History */}
            <div className="profile-section mt-4">
              <h5 className="section-subtitle">
                <CreditCard size={16} /> Fee Payment History
              </h5>
              {payments.filter(p => p.student_id === viewingStudent.id).length === 0 ? (
                <p className="text-muted text-sm">No payment records found.</p>
              ) : (
                <div className="list-group mt-2">
                  {payments
                    .filter(p => p.student_id === viewingStudent.id)
                    .map((p) => (
                      <div key={p.id} className="list-item-row">
                        <div>
                          <strong>{formatCurrency(p.amount_paid)}</strong> - {p.payment_type}
                          <div className="text-xs text-muted">
                            {formatDate(p.payment_date)} • {p.payment_method} {p.billing_period ? `• Period: ${p.billing_period}` : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          {p.receipt_no && <span className="badge badge-mono">#{p.receipt_no}</span>}
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
