// @ts-nocheck
import React, { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/currency';
import { formatDate, getTodayDate, getCurrentPeriod } from '../utils/dates';
import { 
  CreditCard, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Receipt, 
  Printer, 
  Filter, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';

export default function PaymentsTab({ 
  payments = [], 
  students = [], 
  lessons = [], 
  adhocLessons = [], 
  onSavePayment, 
  onDeletePayment,
  prefilledStudent,
  onClearPrefilledStudent 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterType, setFilterType] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [receiptPayment, setReceiptPayment] = useState(null);

  const [paymentForm, setPaymentForm] = useState({
    id: '',
    student_id: '',
    payment_date: getTodayDate(),
    amount_paid: 170,
    payment_type: 'monthly_lesson',
    billing_period: getCurrentPeriod(),
    monthly_lesson_id: '',
    adhoc_lesson_id: '',
    payment_method: 'Bank Transfer',
    receipt_no: '',
    notes: ''
  });
  const [touchedFields, setTouchedFields] = useState({});
  const [formError, setFormError] = useState('');

  // Handle prefilled student from Students tab
  useEffect(() => {
    if (prefilledStudent) {
      openCreatePayment(prefilledStudent.id);
      onClearPrefilledStudent();
    }
  }, [prefilledStudent]);

  const openCreatePayment = (studentId = '') => {
    setEditingPayment(null);
    const initialStudentId = studentId || (students.length > 0 ? students[0].id : '');
    const studentLessons = lessons.filter(l => l.student_id === initialStudentId && l.status === 'active');
    const defaultLesson = studentLessons.length > 0 ? studentLessons[0] : null;

    const receiptNum = `RCP-${Date.now().toString().slice(-6)}`;

    setPaymentForm({
      id: '',
      student_id: initialStudentId,
      payment_date: getTodayDate(),
      amount_paid: defaultLesson ? Number(defaultLesson.monthly_student_fee) : 170,
      payment_type: 'monthly_lesson',
      billing_period: getCurrentPeriod(),
      monthly_lesson_id: defaultLesson ? defaultLesson.id : '',
      adhoc_lesson_id: '',
      payment_method: 'Bank Transfer',
      receipt_no: receiptNum,
      notes: ''
    });
    setFormError('');
    setTouchedFields({});
    setIsModalOpen(true);
  };

  const openEditPayment = (pay) => {
    setEditingPayment(pay);
    setPaymentForm({
      id: pay.id,
      student_id: pay.student_id,
      payment_date: pay.payment_date,
      amount_paid: Number(pay.amount_paid),
      payment_type: pay.payment_type,
      billing_period: pay.billing_period || '',
      monthly_lesson_id: pay.monthly_lesson_id || '',
      adhoc_lesson_id: pay.adhoc_lesson_id || '',
      payment_method: pay.payment_method || 'Cash',
      receipt_no: pay.receipt_no || '',
      notes: pay.notes || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleStudentChange = (sId) => {
    const sLessons = lessons.filter(l => l.student_id === sId && l.status === 'active');
    const defaultLesson = sLessons.length > 0 ? sLessons[0] : null;
    const defaultAmount = defaultLesson ? Number(defaultLesson.monthly_student_fee) : paymentForm.amount_paid;

    setPaymentForm({
      ...paymentForm,
      student_id: sId,
      monthly_lesson_id: defaultLesson ? defaultLesson.id : '',
      amount_paid: defaultAmount
    });
    setTouchedFields(prev => ({ ...prev, student_id: true, monthly_lesson_id: true, amount_paid: true }));
    setTouchedFields(prev => ({ ...prev, student_id: true, monthly_lesson_id: true, amount_paid: true }));
  };

  const handleLessonChange = (lessonId) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (lesson) {
      setPaymentForm({
        ...paymentForm,
        monthly_lesson_id: lesson.id,
        amount_paid: Number(lesson.monthly_student_fee)
      });
    setTouchedFields(prev => ({ ...prev, monthly_lesson_id: true, amount_paid: true }));
    setTouchedFields(prev => ({ ...prev, monthly_lesson_id: true, amount_paid: true }));
    }
  };

  const handleAdhocChange = (adhocId) => {
    const adhoc = adhocLessons.find(a => a.id === adhocId);
    if (adhoc) {
      setPaymentForm({
        ...paymentForm,
        adhoc_lesson_id: adhoc.id,
        amount_paid: Number(adhoc.student_fee)
      });
    setTouchedFields(prev => ({ ...prev, adhoc_lesson_id: true, amount_paid: true }));
    setTouchedFields(prev => ({ ...prev, adhoc_lesson_id: true, amount_paid: true }));
    }
  };

  const handleFieldChange = (field, value) => {
    setPaymentForm(prev => ({ ...prev, [field]: value }));
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!paymentForm.student_id || !paymentForm.amount_paid || !paymentForm.payment_date) {
      setFormError('Please select student, enter payment date and snapshot amount.');
      return;
    }

    try {
      await onSavePayment(paymentForm);
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDelete = async (pay) => {
    if (window.confirm(`Delete payment record of ${formatCurrency(pay.amount_paid)} for ${pay.student_name}?`)) {
      await onDeletePayment(pay.id);
    }
  };

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (
      p.student_name.toLowerCase().includes(term) ||
      p.student_ic.toLowerCase().includes(term) ||
      (p.receipt_no && p.receipt_no.toLowerCase().includes(term))
    );
    const matchesPeriod = !filterPeriod || p.billing_period === filterPeriod;
    const matchesType = filterType === 'all' || p.payment_type === filterType;
    return matchesSearch && matchesPeriod && matchesType;
  });

  const totalFilteredAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

  // Get selected student's active lessons
  const selectedStudentLessons = lessons.filter(
    l => l.student_id === paymentForm.student_id && l.status === 'active'
  );
  // Get selected student's adhoc lessons
  const selectedStudentAdhocs = adhocLessons.filter(
    a => a.student_id === paymentForm.student_id
  );



  // WebRTC Merge Effect for paymentForm
  React.useEffect(() => {
    if (isModalOpen && editingPayment) {
      const updatedItem = payments.find(item => item.id === editingPayment.id);
      if (updatedItem) {
        setPaymentForm(prev => {
          const newData = { ...prev };
          let hasChanges = false;
          const fields = ["student_id","payment_date","amount_paid","payment_type","billing_period","monthly_lesson_id","adhoc_lesson_id","payment_method","receipt_no","notes"];
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
  }, [payments, isModalOpen, editingPayment, touchedFields]);

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
              placeholder="Search receipts by student, IC, or receipt #..."
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
              title="Filter by Billing Period"
            />
            {filterPeriod && (
              <button className="btn btn-xs btn-ghost" onClick={() => setFilterPeriod('')}>
                Clear Period
              </button>
            )}
          </div>

          <select
            className="form-control filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Payment Types</option>
            <option value="monthly_lesson">Monthly Lessons</option>
            <option value="adhoc_lesson">Adhoc Lessons</option>
            <option value="miscellaneous">Miscellaneous</option>
          </select>
        </div>

        <button className="btn btn-primary" onClick={() => openCreatePayment()}>
          <Plus size={16} /> Record Student Fee
        </button>
      </div>

      {/* Summary Banner */}
      <div className="ledger-summary-banner mt-4">
        <div>
          <span className="text-sm text-muted">Total Filtered Collections:</span>
          <span className="summary-total-amount text-success ml-2">
            {formatCurrency(totalFilteredAmount)}
          </span>
        </div>
        <span className="badge badge-info">{filteredPayments.length} receipts listed</span>
      </div>

      {/* Historical Payments Table */}
      <div className="table-responsive content-card mt-3">
        <table className="data-table">
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Date Paid</th>
              <th>Student Name & IC</th>
              <th>Type</th>
              <th>Period</th>
              <th>Snapshot Amount Paid</th>
              <th>Method</th>
              <th>Notes</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-muted">
                  No payment records match your filters.
                </td>
              </tr>
            ) : (
              filteredPayments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button 
                      className="receipt-btn-link"
                      onClick={() => setReceiptPayment(p)}
                      title="View Official Receipt"
                    >
                      <Receipt size={14} /> #{p.receipt_no || p.id.slice(0, 8)}
                    </button>
                  </td>
                  <td>{formatDate(p.payment_date)}</td>
                  <td>
                    <div className="font-semibold text-primary">{p.student_name}</div>
                    <div className="text-xs text-muted font-mono">{p.student_ic}</div>
                  </td>
                  <td>
                    <span className="badge badge-category">
                      {p.payment_type === 'monthly_lesson' ? 'Monthly Lesson' : 
                       p.payment_type === 'adhoc_lesson' ? 'Adhoc Lesson' : 'Other'}
                    </span>
                  </td>
                  <td>
                    {p.billing_period ? <span className="font-mono text-sm">{p.billing_period}</span> : '-'}
                  </td>
                  <td>
                    <strong className="text-success text-base">{formatCurrency(p.amount_paid)}</strong>
                  </td>
                  <td>
                    <span className="badge badge-muted">{p.payment_method}</span>
                  </td>
                  <td className="text-sm text-muted">{p.notes || '-'}</td>
                  <td className="text-right table-actions">
                    <button 
                      className="btn-icon-subtle" 
                      title="View Receipt"
                      onClick={() => setReceiptPayment(p)}
                    >
                      <Receipt size={16} />
                    </button>
                    <button 
                      className="btn-icon-subtle" 
                      title="Edit Payment"
                      onClick={() => openEditPayment(p)}
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      className="btn-icon-subtle text-danger" 
                      title="Delete Payment"
                      onClick={() => handleDelete(p)}
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

      {/* Record / Edit Payment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPayment ? 'Edit Payment Record' : 'Record Student Fee Payment'}
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
              <label className="form-label required">Student</label>
              <select
                className="form-control"
                required
                value={paymentForm.student_id}
                onChange={(e) => handleStudentChange(e.target.value)}
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
              <label className="form-label required">Payment Type</label>
              <select
                className="form-control"
                value={paymentForm.payment_type}
                onChange={(e) => handleFieldChange('payment_type', e.target.value)}
              >
                <option value="monthly_lesson">Monthly Lesson Fee</option>
                <option value="adhoc_lesson">Adhoc Lesson Fee</option>
                <option value="miscellaneous">Miscellaneous / Other</option>
              </select>
            </div>
          </div>

          {/* If Monthly Lesson */}
          {paymentForm.payment_type === 'monthly_lesson' && (
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Linked Scheduled Lesson</label>
                <select
                  className="form-control"
                  value={paymentForm.monthly_lesson_id}
                  onChange={(e) => handleLessonChange(e.target.value)}
                >
                  <option value="">-- Select Lesson (Optional) --</option>
                  {selectedStudentLessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.instrument} ({l.grade}) - {formatCurrency(l.monthly_student_fee)}/mo
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Billing Period (YYYY-MM)</label>
                <input
                  type="month"
                  className="form-control"
                  value={paymentForm.billing_period}
                  onChange={(e) => handleFieldChange('billing_period', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* If Adhoc Lesson */}
          {paymentForm.payment_type === 'adhoc_lesson' && (
            <div className="form-group">
              <label className="form-label">Linked Adhoc Session</label>
              <select
                className="form-control"
                value={paymentForm.adhoc_lesson_id}
                onChange={(e) => handleAdhocChange(e.target.value)}
              >
                <option value="">-- Select Adhoc Session (Optional) --</option>
                {selectedStudentAdhocs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.lesson_date}: {a.instrument} ({formatCurrency(a.student_fee)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">
                Actual Amount Paid ($)
                <span className="text-xs text-muted block">Snapshot amount preserved historically</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-control"
                required
                value={paymentForm.amount_paid}
                onChange={(e) => handleFieldChange('amount_paid', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Payment Date</label>
              <input
                type="date"
                className="form-control"
                required
                value={paymentForm.payment_date}
                onChange={(e) => handleFieldChange('payment_date', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Payment Method</label>
              <select
                className="form-control"
                value={paymentForm.payment_method}
                onChange={(e) => handleFieldChange('payment_method', e.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="DuitNow / QR">DuitNow / QR Code</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Receipt Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. RCP-102938"
                value={paymentForm.receipt_no}
                onChange={(e) => handleFieldChange('receipt_no', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Paid in full for October lesson bundle"
              value={paymentForm.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
            />
          </div>

          <div className="modal-actions mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingPayment ? 'Save Changes' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Receipt Modal */}
      {receiptPayment && (
        <Modal
          isOpen={Boolean(receiptPayment)}
          onClose={() => setReceiptPayment(null)}
          title="Official Student Payment Receipt"
          maxWidth="560px"
        >
          <div className="receipt-container" id="printable-receipt">
            <div className="receipt-header">
              <img src="./logo.jpg" alt="Logo" className="receipt-logo" />
              <div>
                <h3 className="receipt-school-name">MUSIC ACADEMY</h3>
                <p className="receipt-school-sub">Official Student Fee Receipt</p>
              </div>
            </div>

            <div className="receipt-divider"></div>

            <div className="receipt-meta-grid">
              <div>
                <span className="receipt-meta-label">Receipt No:</span>
                <span className="receipt-meta-val font-mono">#{receiptPayment.receipt_no || receiptPayment.id.slice(0, 8)}</span>
              </div>
              <div>
                <span className="receipt-meta-label">Date:</span>
                <span className="receipt-meta-val">{formatDate(receiptPayment.payment_date)}</span>
              </div>
              <div>
                <span className="receipt-meta-label">Student Name:</span>
                <span className="receipt-meta-val font-bold">{receiptPayment.student_name}</span>
              </div>
              <div>
                <span className="receipt-meta-label">Student IC:</span>
                <span className="receipt-meta-val font-mono">{receiptPayment.student_ic}</span>
              </div>
              <div>
                <span className="receipt-meta-label">Payment Type:</span>
                <span className="receipt-meta-val capitalize">{receiptPayment.payment_type.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="receipt-meta-label">Billing Period:</span>
                <span className="receipt-meta-val">{receiptPayment.billing_period || '-'}</span>
              </div>
            </div>

            <div className="receipt-items-table mt-4">
              <div className="receipt-item-row header">
                <span>Description</span>
                <span className="text-right">Amount</span>
              </div>
              <div className="receipt-item-row">
                <span>
                  Fee Payment ({receiptPayment.payment_type.replace('_', ' ')})
                  {receiptPayment.billing_period ? ` - ${receiptPayment.billing_period}` : ''}
                </span>
                <span className="text-right font-bold">{formatCurrency(receiptPayment.amount_paid)}</span>
              </div>
              <div className="receipt-item-row total">
                <span>Total Paid ({receiptPayment.payment_method})</span>
                <span className="text-right text-success font-bold text-lg">
                  {formatCurrency(receiptPayment.amount_paid)}
                </span>
              </div>
            </div>

            {receiptPayment.notes && (
              <div className="receipt-notes mt-3">
                <span className="receipt-meta-label">Notes:</span> {receiptPayment.notes}
              </div>
            )}

            <div className="receipt-footer mt-6">
              <p className="text-xs text-muted">Thank you for your payment! This is a system-generated official receipt.</p>
            </div>

            <div className="receipt-print-actions mt-4">
              <button 
                className="btn btn-primary btn-block" 
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
