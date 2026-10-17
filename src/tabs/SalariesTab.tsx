// @ts-nocheck
import React, { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/currency';
import { formatDate, getTodayDate, getCurrentPeriod } from '../utils/dates';
import { 
  Wallet, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  FileText, 
  Printer, 
  Calculator, 
  AlertCircle 
} from 'lucide-react';

export default function SalariesTab({ 
  salaries = [], 
  teachers = [], 
  lessons = [], 
  adhocLessons = [], 
  onSaveSalary, 
  onDeleteSalary,
  prefilledTeacher,
  onClearPrefilledTeacher 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState(null);
  const [voucherSalary, setVoucherSalary] = useState(null);

  const [salaryForm, setSalaryForm] = useState({
    id: '',
    teacher_id: '',
    payout_date: getTodayDate(),
    amount_paid: 500,
    salary_type: 'monthly_lessons',
    period: getCurrentPeriod(),
    monthly_lesson_id: '',
    adhoc_lesson_id: '',
    payment_method: 'Bank Transfer',
    voucher_no: '',
    notes: ''
  });
  const [touchedFields, setTouchedFields] = useState({});
  const [formError, setFormError] = useState('');

  // Handle prefilled teacher from Teachers tab
  useEffect(() => {
    if (prefilledTeacher) {
      openCreateSalary(prefilledTeacher.id);
      onClearPrefilledTeacher();
    }
  }, [prefilledTeacher]);

  const openCreateSalary = (teacherId = '') => {
    setEditingSalary(null);
    const initialTeacherId = teacherId || (teachers.length > 0 ? teachers[0].id : '');
    const teacherLessons = lessons.filter(l => l.teacher_id === initialTeacherId && l.status === 'active');
    const totalExpectedPay = teacherLessons.reduce((sum, l) => sum + Number(l.monthly_teacher_rate || 0), 0);

    const voucherNum = `VCH-${Date.now().toString().slice(-6)}`;

    setSalaryForm({
      id: '',
      teacher_id: initialTeacherId,
      payout_date: getTodayDate(),
      amount_paid: totalExpectedPay || 300,
      salary_type: 'monthly_lessons',
      period: getCurrentPeriod(),
      monthly_lesson_id: '',
      adhoc_lesson_id: '',
      payment_method: 'Bank Transfer',
      voucher_no: voucherNum,
      notes: ''
    });
    setFormError('');
    setTouchedFields({});
    setIsModalOpen(true);
  };

  const openEditSalary = (sal) => {
    setEditingSalary(sal);
    setSalaryForm({
      id: sal.id,
      teacher_id: sal.teacher_id,
      payout_date: sal.payout_date,
      amount_paid: Number(sal.amount_paid),
      salary_type: sal.salary_type,
      period: sal.period,
      monthly_lesson_id: sal.monthly_lesson_id || '',
      adhoc_lesson_id: sal.adhoc_lesson_id || '',
      payment_method: sal.payment_method || 'Bank Transfer',
      voucher_no: sal.voucher_no || '',
      notes: sal.notes || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleTeacherChange = (tId) => {
    const tLessons = lessons.filter(l => l.teacher_id === tId && l.status === 'active');
    const totalExpected = tLessons.reduce((sum, l) => sum + Number(l.monthly_teacher_rate || 0), 0);

    setSalaryForm({
      ...salaryForm,
      teacher_id: tId,
      amount_paid: totalExpected || salaryForm.amount_paid
    });
  };

  // Quick calculate monthly salary helper
  const calculateTeacherMonthlyExpected = (tId) => {
    const tLessons = lessons.filter(l => l.teacher_id === tId && l.status === 'active');
    return tLessons.reduce((sum, l) => sum + Number(l.monthly_teacher_rate || 0), 0);
  };

  const handleFieldChange = (field, value) => {
    setSalaryForm(prev => ({ ...prev, [field]: value }));
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!salaryForm.teacher_id || !salaryForm.amount_paid || !salaryForm.payout_date || !salaryForm.period) {
      setFormError('Please fill in teacher, payout date, period, and snapshot amount.');
      return;
    }

    try {
      await onSaveSalary(salaryForm);
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDelete = async (sal) => {
    if (window.confirm(`Delete salary record of ${formatCurrency(sal.amount_paid)} for ${sal.teacher_name}?`)) {
      await onDeleteSalary(sal.id);
    }
  };

  // Filter salaries
  const filteredSalaries = salaries.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (
      s.teacher_name.toLowerCase().includes(term) ||
      s.teacher_ic.toLowerCase().includes(term) ||
      (s.voucher_no && s.voucher_no.toLowerCase().includes(term))
    );
    const matchesPeriod = !filterPeriod || s.period === filterPeriod;
    return matchesSearch && matchesPeriod;
  });

  const totalFilteredDisbursed = filteredSalaries.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);



  // WebRTC Merge Effect for salaryForm
  React.useEffect(() => {
    if (isModalOpen && editingSalary) {
      const updatedItem = salaries.find(item => item.id === editingSalary.id);
      if (updatedItem) {
        setSalaryForm(prev => {
          const newData = { ...prev };
          let hasChanges = false;
          const fields = ["teacher_id","payout_date","amount_paid","salary_type","period","monthly_lesson_id","adhoc_lesson_id","payment_method","voucher_no","notes"];
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
  }, [salaries, isModalOpen, editingSalary, touchedFields]);

  return (
    <div className="tab-pane-content">
      {/* Top Filter and Action Bar */}
      <div className="table-action-bar">
        <div className="filter-controls-row">
          <div className="search-input-wrap">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search salary records by teacher, IC, voucher #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="period-filter-wrap">
            <input
              type="month"
              className="form-control"
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              title="Filter by Salary Period"
            />
            {filterPeriod && (
              <button className="btn btn-xs btn-ghost" onClick={() => setFilterPeriod('')}>
                Clear Period
              </button>
            )}
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => openCreateSalary()}>
          <Plus size={16} /> Record Salary Payout
        </button>
      </div>

      {/* Summary Banner */}
      <div className="ledger-summary-banner mt-4">
        <div>
          <span className="text-sm text-muted">Total Filtered Payouts:</span>
          <span className="summary-total-amount text-primary ml-2">
            {formatCurrency(totalFilteredDisbursed)}
          </span>
        </div>
        <span className="badge badge-info">{filteredSalaries.length} vouchers listed</span>
      </div>

      {/* Historical Salaries Table */}
      <div className="table-responsive content-card mt-3">
        <table className="data-table">
          <thead>
            <tr>
              <th>Voucher #</th>
              <th>Payout Date</th>
              <th>Teacher Name & IC</th>
              <th>Period</th>
              <th>Salary Type</th>
              <th>Snapshot Amount Paid</th>
              <th>Method</th>
              <th>Notes</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSalaries.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-muted">
                  No salary disbursement records match your filters.
                </td>
              </tr>
            ) : (
              filteredSalaries.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button 
                      className="receipt-btn-link"
                      onClick={() => setVoucherSalary(s)}
                      title="View Payout Voucher"
                    >
                      <FileText size={14} /> #{s.voucher_no || s.id.slice(0, 8)}
                    </button>
                  </td>
                  <td>{formatDate(s.payout_date)}</td>
                  <td>
                    <div className="font-semibold text-primary">{s.teacher_name}</div>
                    <div className="text-xs text-muted font-mono">{s.teacher_ic}</div>
                  </td>
                  <td>
                    <span className="font-mono font-medium">{s.period}</span>
                  </td>
                  <td>
                    <span className="badge badge-category">
                      {s.salary_type === 'monthly_lessons' ? 'Monthly Lessons' : 
                       s.salary_type === 'adhoc_lessons' ? 'Adhoc Lessons' : s.salary_type}
                    </span>
                  </td>
                  <td>
                    <strong className="text-primary text-base">{formatCurrency(s.amount_paid)}</strong>
                  </td>
                  <td>
                    <span className="badge badge-muted">{s.payment_method}</span>
                  </td>
                  <td className="text-sm text-muted">{s.notes || '-'}</td>
                  <td className="text-right table-actions">
                    <button 
                      className="btn-icon-subtle" 
                      title="View Voucher"
                      onClick={() => setVoucherSalary(s)}
                    >
                      <FileText size={16} />
                    </button>
                    <button 
                      className="btn-icon-subtle" 
                      title="Edit Salary"
                      onClick={() => openEditSalary(s)}
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      className="btn-icon-subtle text-danger" 
                      title="Delete Salary"
                      onClick={() => handleDelete(s)}
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

      {/* Record / Edit Salary Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSalary ? 'Edit Teacher Salary Record' : 'Record Teacher Salary Disbursement'}
        maxWidth="620px"
      >
        <form onSubmit={handleSubmit} className="form-layout">
          {formError && (
            <div className="form-alert error">
              <AlertCircle size={16} /> {formError}
            </div>
          )}

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Teacher</label>
              <select
                className="form-control"
                required
                value={salaryForm.teacher_id}
                onChange={(e) => handleTeacherChange(e.target.value)}
              >
                <option value="">-- Select Teacher --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.ic})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Salary Period (YYYY-MM)</label>
              <input
                type="month"
                className="form-control"
                required
                value={salaryForm.period}
                onChange={(e) => handleFieldChange('period', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Salary Type</label>
              <select
                className="form-control"
                value={salaryForm.salary_type}
                onChange={(e) => handleFieldChange('salary_type', e.target.value)}
              >
                <option value="monthly_lessons">Monthly Scheduled Lessons</option>
                <option value="adhoc_lessons">Adhoc Lessons</option>
                <option value="combined">Combined Monthly Payroll</option>
                <option value="bonus/adjustment">Bonus / Adjustment</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Payout Date</label>
              <input
                type="date"
                className="form-control"
                required
                value={salaryForm.payout_date}
                onChange={(e) => handleFieldChange('payout_date', e.target.value)}
              />
            </div>
          </div>

          {/* Quick Pay Calculation Prompt */}
          <div className="rate-resolver-box">
            <div className="rate-resolver-header">
              <span className="text-xs text-muted">
                <Calculator size={13} className="inline mr-1" />
                Active Monthly Lessons for Teacher: <strong>{formatCurrency(calculateTeacherMonthlyExpected(salaryForm.teacher_id))}/mo</strong>
              </span>
              <button
                type="button"
                className="btn btn-xs btn-outline"
                onClick={() => setSalaryForm({ ...salaryForm, amount_paid: calculateTeacherMonthlyExpected(salaryForm.teacher_id) })}
              >
                Apply Calculated Amount
              </button>
            </div>

            <div className="form-group mt-2">
              <label className="form-label required">
                Actual Salary Amount Paid ($)
                <span className="text-xs text-muted block">Historical snapshot amount stored at transaction time</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-control"
                required
                value={salaryForm.amount_paid}
                onChange={(e) => handleFieldChange('amount_paid', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row-2 mt-3">
            <div className="form-group">
              <label className="form-label required">Payment Method</label>
              <select
                className="form-control"
                value={salaryForm.payment_method}
                onChange={(e) => handleFieldChange('payment_method', e.target.value)}
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Voucher #</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. VCH-002931"
                value={salaryForm.voucher_no}
                onChange={(e) => handleFieldChange('voucher_no', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. October payroll payout"
              value={salaryForm.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
            />
          </div>

          <div className="modal-actions mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingSalary ? 'Save Changes' : 'Record Salary Payout'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Salary Voucher Modal */}
      {voucherSalary && (
        <Modal
          isOpen={Boolean(voucherSalary)}
          onClose={() => setVoucherSalary(null)}
          title="Official Teacher Salary Voucher"
          maxWidth="560px"
        >
          <div className="receipt-container" id="printable-voucher">
            <div className="receipt-header">
              <img src="./logo.jpg" alt="Logo" className="receipt-logo" />
              <div>
                <h3 className="receipt-school-name">MUSIC ACADEMY</h3>
                <p className="receipt-school-sub">Official Salary Disbursement Voucher</p>
              </div>
            </div>

            <div className="receipt-divider"></div>

            <div className="receipt-meta-grid">
              <div>
                <span className="receipt-meta-label">Voucher No:</span>
                <span className="receipt-meta-val font-mono">#{voucherSalary.voucher_no || voucherSalary.id.slice(0, 8)}</span>
              </div>
              <div>
                <span className="receipt-meta-label">Payout Date:</span>
                <span className="receipt-meta-val">{formatDate(voucherSalary.payout_date)}</span>
              </div>
              <div>
                <span className="receipt-meta-label">Teacher Name:</span>
                <span className="receipt-meta-val font-bold">{voucherSalary.teacher_name}</span>
              </div>
              <div>
                <span className="receipt-meta-label">Teacher IC:</span>
                <span className="receipt-meta-val font-mono">{voucherSalary.teacher_ic}</span>
              </div>
              <div>
                <span className="receipt-meta-label">Salary Period:</span>
                <span className="receipt-meta-val font-bold">{voucherSalary.period}</span>
              </div>
              <div>
                <span className="receipt-meta-label">Type:</span>
                <span className="receipt-meta-val capitalize">{voucherSalary.salary_type.replace('_', ' ')}</span>
              </div>
            </div>

            <div className="receipt-items-table mt-4">
              <div className="receipt-item-row header">
                <span>Disbursement Details</span>
                <span className="text-right">Amount</span>
              </div>
              <div className="receipt-item-row">
                <span>Teaching Remuneration for Period {voucherSalary.period}</span>
                <span className="text-right font-bold">{formatCurrency(voucherSalary.amount_paid)}</span>
              </div>
              <div className="receipt-item-row total">
                <span>Net Disbursed ({voucherSalary.payment_method})</span>
                <span className="text-right text-primary font-bold text-lg">
                  {formatCurrency(voucherSalary.amount_paid)}
                </span>
              </div>
            </div>

            {voucherSalary.notes && (
              <div className="receipt-notes mt-3">
                <span className="receipt-meta-label">Notes:</span> {voucherSalary.notes}
              </div>
            )}

            <div className="receipt-footer mt-6">
              <p className="text-xs text-muted">Disbursed by School Administration. Retain for personal tax records.</p>
            </div>

            <div className="receipt-print-actions mt-4">
              <button 
                className="btn btn-primary btn-block" 
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print Voucher
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
