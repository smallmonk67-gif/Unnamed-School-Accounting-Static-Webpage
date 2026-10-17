// @ts-nocheck
import React, { useState } from 'react';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/currency';
import { 
  Settings2, 
  Layers, 
  Sparkles, 
  Plus, 
  Edit, 
  Trash2, 
  Music, 
  Award, 
  AlertCircle 
} from 'lucide-react';

export default function RateTemplatesTab({ 
  categories = [], 
  rateTemplates = [], 
  customizedRates = [], 
  students = [], 
  teachers = [], 
  onSaveCategory, 
  onDeleteCategory, 
  onSaveRateTemplate, 
  onSaveCustomizedRate, 
  onDeleteCustomizedRate 
}) {
  const [subTab, setSubTab] = useState('categories'); // 'categories', 'templates', 'customized'

  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catForm, setCatForm] = useState({
    id: '',
    name: '',
    instrument: 'Piano',
    certificate: ''
  });
  const [touchedCatFields, setTouchedCatFields] = useState({});
  const [catError, setCatError] = useState('');

  // Rate Template Modal State
  const [isTplModalOpen, setIsTplModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [tplForm, setTplForm] = useState({
    id: '',
    category_id: '',
    grade: 'Grade 1',
    duration_minutes: 45,
    default_student_fee: 170,
    default_teacher_rate: 100
  });
  const [touchedTplFields, setTouchedTplFields] = useState({});
  const [tplError, setTplError] = useState('');

  // Customized Rate Modal State
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [editingCustomRate, setEditingCustomRate] = useState(null);
  const [customForm, setCustomForm] = useState({
    id: '',
    student_id: '',
    teacher_id: '',
    instrument: 'Piano',
    duration_minutes: 45,
    custom_student_fee: 150,
    custom_teacher_rate: 90,
    notes: ''
  });
  const [touchedCustomFields, setTouchedCustomFields] = useState({});
  const [customError, setCustomError] = useState('');

  // --- Category Handlers ---
  const openCreateCategory = () => {
    setEditingCategory(null);
    setCatForm({
      id: '',
      name: '',
      instrument: 'Piano',
      certificate: ''
    });
    setCatError('');
    setTouchedCatFields({});
    setIsCatModalOpen(true);
  };

  const openEditCategory = (cat) => {
    setEditingCategory(cat);
    setCatForm({
      id: cat.id,
      name: cat.name,
      instrument: cat.instrument,
      certificate: cat.certificate
    });
    setCatError('');
    setTouchedCatFields({});
    setIsCatModalOpen(true);
  };

  const handleCatFieldChange = (field, value) => {
    setCatForm(prev => ({ ...prev, [field]: value }));
    setTouchedCatFields(prev => ({ ...prev, [field]: true }));
  };

  const handleTplFieldChange = (field, value) => {
    setTplForm(prev => ({ ...prev, [field]: value }));
    setTouchedTplFields(prev => ({ ...prev, [field]: true }));
  };

  const handleCustomFieldChange = (field, value) => {
    setCustomForm(prev => ({ ...prev, [field]: value }));
    setTouchedCustomFields(prev => ({ ...prev, [field]: true }));
  };

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    if (!catForm.name.trim() || !catForm.instrument.trim() || !catForm.certificate.trim()) {
      setCatError('Please fill in category name, instrument, and certificate requirement.');
      return;
    }

    try {
      await onSaveCategory(catForm);
      setIsCatModalOpen(false);
    } catch (err) {
      setCatError(err.message);
    }
  };

  const handleDeleteCat = async (cat) => {
    if (window.confirm(`Delete teacher category "${cat.name}" and its associated rate templates?`)) {
      await onDeleteCategory(cat.id);
    }
  };

  // --- Rate Template Handlers ---
  const openCreateTemplate = () => {
    setEditingTemplate(null);
    const initialCatId = selectedCategoryFilter || (categories.length > 0 ? categories[0].id : '');
    setTplForm({
      id: '',
      category_id: initialCatId,
      grade: 'Grade 1',
      duration_minutes: 45,
      default_student_fee: 170,
      default_teacher_rate: 100
    });
    setTplError('');
    setTouchedTplFields({});
    setIsTplModalOpen(true);
  };

  const openEditTemplate = (tpl) => {
    setEditingTemplate(tpl);
    setTplForm({
      id: tpl.id,
      category_id: tpl.category_id,
      grade: tpl.grade,
      duration_minutes: Number(tpl.duration_minutes),
      default_student_fee: Number(tpl.default_student_fee),
      default_teacher_rate: Number(tpl.default_teacher_rate)
    });
    setTplError('');
    setTouchedTplFields({});
    setIsTplModalOpen(true);
  };

  const handleTplSubmit = async (e) => {
    e.preventDefault();
    if (!tplForm.category_id || !tplForm.grade) {
      setTplError('Please select a category and grade.');
      return;
    }

    try {
      await onSaveRateTemplate(tplForm);
      setIsTplModalOpen(false);
    } catch (err) {
      setTplError(err.message);
    }
  };

  // --- Customized Rate Handlers ---
  const openCreateCustom = () => {
    setEditingCustomRate(null);
    setCustomForm({
      id: '',
      student_id: students.length > 0 ? students[0].id : '',
      teacher_id: teachers.length > 0 ? teachers[0].id : '',
      instrument: 'Piano',
      duration_minutes: 45,
      custom_student_fee: 150,
      custom_teacher_rate: 90,
      notes: ''
    });
    setCustomError('');
    setTouchedCustomFields({});
    setIsCustomModalOpen(true);
  };

  const openEditCustom = (cr) => {
    setEditingCustomRate(cr);
    setCustomForm({
      id: cr.id,
      student_id: cr.student_id,
      teacher_id: cr.teacher_id,
      instrument: cr.instrument,
      duration_minutes: Number(cr.duration_minutes),
      custom_student_fee: Number(cr.custom_student_fee),
      custom_teacher_rate: Number(cr.custom_teacher_rate),
      notes: cr.notes || ''
    });
    setCustomError('');
    setTouchedCustomFields({});
    setIsCustomModalOpen(true);
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    if (!customForm.student_id || !customForm.teacher_id || !customForm.instrument) {
      setCustomError('Please select student, teacher, and instrument.');
      return;
    }

    try {
      await onSaveCustomizedRate(customForm);
      setIsCustomModalOpen(false);
    } catch (err) {
      setCustomError(err.message);
    }
  };

  const handleDeleteCustom = async (cr) => {
    if (window.confirm(`Delete customized rate for ${cr.student_name} with ${cr.teacher_name}?`)) {
      await onDeleteCustomizedRate(cr.id);
    }
  };

  // Filter templates by selected category
  const filteredTemplates = selectedCategoryFilter
    ? rateTemplates.filter(t => t.category_id === selectedCategoryFilter)
    : rateTemplates;

  const gradesList = [
    'Beginner', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 
    'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Diploma'
  ];

  // WebRTC Merge Effect for catForm
  React.useEffect(() => {
    if (isCatModalOpen && editingCategory) {
      const updatedItem = categories.find(item => item.id === editingCategory.id);
      if (updatedItem) {
        setCatForm(prev => {
          const newData = { ...prev };
          let hasChanges = false;
          const fields = ["name", "instrument", "certificate"];
          for (const field of fields) {
            if (!touchedCatFields[field] && updatedItem[field] !== undefined && updatedItem[field] !== null) {
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
  }, [categories, isCatModalOpen, editingCategory, touchedCatFields]);

  // WebRTC Merge Effect for tplForm
  React.useEffect(() => {
    if (isTplModalOpen && editingTemplate) {
      const updatedItem = rateTemplates.find(item => item.id === editingTemplate.id);
      if (updatedItem) {
        setTplForm(prev => {
          const newData = { ...prev };
          let hasChanges = false;
          const fields = ["category_id","grade","duration_minutes","default_student_fee","default_teacher_rate"];
          for (const field of fields) {
            if (!touchedTplFields[field] && updatedItem[field] !== undefined && updatedItem[field] !== null) {
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
  }, [rateTemplates, isTplModalOpen, editingTemplate, touchedTplFields]);

  // WebRTC Merge Effect for customForm
  React.useEffect(() => {
    if (isCustomModalOpen && editingCustomRate) {
      const updatedItem = customizedRates.find(item => item.id === editingCustomRate.id);
      if (updatedItem) {
        setCustomForm(prev => {
          const newData = { ...prev };
          let hasChanges = false;
          const fields = ["teacher_id","student_id","instrument","duration_minutes","custom_student_fee","custom_teacher_rate","notes"];
          for (const field of fields) {
            if (!touchedCustomFields[field] && updatedItem[field] !== undefined && updatedItem[field] !== null) {
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
  }, [customizedRates, isCustomModalOpen, editingCustomRate, touchedCustomFields]);

  return (
    <div className="tab-pane-content">
      {/* Subtab navigation */}
      <div className="subnav-container">
        <button 
          className={`subnav-btn ${subTab === 'categories' ? 'active' : ''}`}
          onClick={() => setSubTab('categories')}
        >
          <Award size={16} /> Teacher Categories ({categories.length})
        </button>
        <button 
          className={`subnav-btn ${subTab === 'templates' ? 'active' : ''}`}
          onClick={() => setSubTab('templates')}
        >
          <Layers size={16} /> Monthly Rate Matrix ({rateTemplates.length})
        </button>
        <button 
          className={`subnav-btn ${subTab === 'customized' ? 'active' : ''}`}
          onClick={() => setSubTab('customized')}
        >
          <Sparkles size={16} /> Customized Rate Overrides ({customizedRates.length})
        </button>
      </div>

      {/* --- Subtab 1: Teacher Categories --- */}
      {subTab === 'categories' && (
        <div className="mt-4">
          <div className="table-action-bar">
            <div>
              <p className="text-sm text-muted">
                Define categories by <strong>Music Instrument</strong> and <strong>Certificate / Qualification</strong> level. 
                Teachers are assigned categories per instrument.
              </p>
            </div>
            <button className="btn btn-primary" onClick={openCreateCategory}>
              <Plus size={16} /> Create Category
            </button>
          </div>

          <div className="table-responsive content-card mt-3">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Instrument</th>
                  <th>Certificate / Qualification Level</th>
                  <th>Rate Templates Configured</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-6 text-muted">
                      No teacher categories defined yet.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => {
                    const count = rateTemplates.filter(t => t.category_id === cat.id).length;
                    return (
                      <tr key={cat.id}>
                        <td>
                          <div className="font-semibold text-primary">{cat.name}</div>
                        </td>
                        <td>
                          <span className="chip chip-instrument">
                            <Music size={12} /> {cat.instrument}
                          </span>
                        </td>
                        <td>
                          <span className="font-medium text-dark">{cat.certificate}</span>
                        </td>
                        <td>
                          <span className="badge badge-info">{count} rate grades</span>
                        </td>
                        <td className="text-right table-actions">
                          <button 
                            className="btn-icon-subtle" 
                            title="Edit Category"
                            onClick={() => openEditCategory(cat)}
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="btn-icon-subtle text-danger" 
                            title="Delete Category"
                            onClick={() => handleDeleteCat(cat)}
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
        </div>
      )}

      {/* --- Subtab 2: Monthly Rate Matrix --- */}
      {subTab === 'templates' && (
        <div className="mt-4">
          <div className="table-action-bar">
            <div className="category-filter-wrap">
              <label className="text-sm font-medium mr-2">Filter Category:</label>
              <select
                className="form-control inline-select"
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              >
                <option value="">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.instrument})
                  </option>
                ))}
              </select>
            </div>

            <button className="btn btn-primary" onClick={openCreateTemplate}>
              <Plus size={16} /> Add Rate Template
            </button>
          </div>

          <div className="table-responsive content-card mt-3">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Instrument</th>
                  <th>Lesson Grade</th>
                  <th>Duration</th>
                  <th>Monthly Student Fee ($)</th>
                  <th>Monthly Teacher Rate ($)</th>
                  <th>School Margin ($)</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-6 text-muted">
                      No rate templates found. Add templates or clear filter.
                    </td>
                  </tr>
                ) : (
                  filteredTemplates.map((tpl) => {
                    const margin = Number(tpl.default_student_fee) - Number(tpl.default_teacher_rate);
                    return (
                      <tr key={tpl.id}>
                        <td>
                          <strong>{tpl.category_name}</strong>
                        </td>
                        <td>
                          <span className="chip chip-instrument">
                            <Music size={12} /> {tpl.instrument}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-grade">{tpl.grade}</span>
                        </td>
                        <td>{tpl.duration_minutes} mins</td>
                        <td>
                          <strong className="text-primary text-base">
                            {formatCurrency(tpl.default_student_fee)}/mo
                          </strong>
                        </td>
                        <td>
                          <strong className="text-success text-base">
                            {formatCurrency(tpl.default_teacher_rate)}/mo
                          </strong>
                        </td>
                        <td>
                          <span className="font-semibold text-muted">
                            {formatCurrency(margin)}
                          </span>
                        </td>
                        <td className="text-right table-actions">
                          <button 
                            className="btn-icon-subtle" 
                            title="Edit Rate"
                            onClick={() => openEditTemplate(tpl)}
                          >
                            <Edit size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Subtab 3: Customized Rates --- */}
      {subTab === 'customized' && (
        <div className="mt-4">
          <div className="table-action-bar">
            <div>
              <p className="text-sm text-muted">
                Custom rates override the standard templates specifically for a unique 
                <strong> (Student, Teacher, Instrument, Duration)</strong> combination.
              </p>
            </div>
            <button className="btn btn-primary" onClick={openCreateCustom}>
              <Plus size={16} /> Add Custom Override
            </button>
          </div>

          <div className="table-responsive content-card mt-3">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Teacher Name</th>
                  <th>Instrument</th>
                  <th>Duration</th>
                  <th>Custom Student Fee ($)</th>
                  <th>Custom Teacher Rate ($)</th>
                  <th>Notes</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customizedRates.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-6 text-muted">
                      No customized rate overrides defined.
                    </td>
                  </tr>
                ) : (
                  customizedRates.map((cr) => (
                    <tr key={cr.id}>
                      <td>
                        <strong className="text-primary">{cr.student_name}</strong>
                      </td>
                      <td>
                        <strong>{cr.teacher_name}</strong>
                      </td>
                      <td>
                        <span className="chip chip-instrument">
                          <Music size={12} /> {cr.instrument}
                        </span>
                      </td>
                      <td>{cr.duration_minutes} mins</td>
                      <td>
                        <strong className="text-primary">{formatCurrency(cr.custom_student_fee)}/mo</strong>
                      </td>
                      <td>
                        <strong className="text-success">{formatCurrency(cr.custom_teacher_rate)}/mo</strong>
                      </td>
                      <td className="text-sm text-muted">{cr.notes || '-'}</td>
                      <td className="text-right table-actions">
                        <button 
                          className="btn-icon-subtle" 
                          title="Edit Custom Rate"
                          onClick={() => openEditCustom(cr)}
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          className="btn-icon-subtle text-danger" 
                          title="Delete Custom Rate"
                          onClick={() => handleDeleteCustom(cr)}
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
        </div>
      )}

      {/* Category Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCategory ? 'Edit Teacher Category' : 'Create Teacher Category'}
        maxWidth="500px"
      >
        <form onSubmit={handleCatSubmit} className="form-layout">
          {catError && <div className="form-alert error">{catError}</div>}

          <div className="form-group">
            <label className="form-label required">Category Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Senior Piano Specialist"
              required
              value={catForm.name}
              onChange={(e) => handleCatFieldChange('name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label required">Music Instrument</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Piano, Violin, Vocal"
              required
              value={catForm.instrument}
              onChange={(e) => handleCatFieldChange('instrument', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label required">Certificate / Qualification Requirement</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Trinity ATCL, ABRSM Grade 8"
              required
              value={catForm.certificate}
              onChange={(e) => handleCatFieldChange('certificate', e.target.value)}
            />
          </div>

          <div className="modal-actions mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setIsCatModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Rate Template Modal */}
      <Modal
        isOpen={isTplModalOpen}
        onClose={() => setIsTplModalOpen(false)}
        title={editingTemplate ? 'Edit Rate Template' : 'Add Rate Template'}
        maxWidth="520px"
      >
        <form onSubmit={handleTplSubmit} className="form-layout">
          {tplError && <div className="form-alert error">{tplError}</div>}

          <div className="form-group">
            <label className="form-label required">Teacher Category</label>
            <select
              className="form-control"
              required
              value={tplForm.category_id}
              onChange={(e) => handleTplFieldChange('category_id', e.target.value)}
            >
              <option value="">-- Select Category --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.instrument} - {c.certificate})
                </option>
              ))}
            </select>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Grade</label>
              <select
                className="form-control"
                required
                value={tplForm.grade}
                onChange={(e) => handleTplFieldChange('grade', e.target.value)}
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
                value={tplForm.duration_minutes}
                onChange={(e) => handleTplFieldChange('duration_minutes', Number(e.target.value))}
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Monthly Student Fee ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                required
                value={tplForm.default_student_fee}
                onChange={(e) => handleTplFieldChange('default_student_fee', e.target.value)}
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
                value={tplForm.default_teacher_rate}
                onChange={(e) => handleTplFieldChange('default_teacher_rate', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-actions mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setIsTplModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingTemplate ? 'Save Changes' : 'Add Template'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Customized Rate Modal */}
      <Modal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        title={editingCustomRate ? 'Edit Customized Rate Override' : 'Add Customized Rate Override'}
        maxWidth="600px"
      >
        <form onSubmit={handleCustomSubmit} className="form-layout">
          {customError && <div className="form-alert error">{customError}</div>}

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Student</label>
              <select
                className="form-control"
                required
                value={customForm.student_id}
                onChange={(e) => handleCustomFieldChange('student_id', e.target.value)}
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
                value={customForm.teacher_id}
                onChange={(e) => handleCustomFieldChange('teacher_id', e.target.value)}
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
              <label className="form-label required">Instrument</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Piano, Violin"
                required
                value={customForm.instrument}
                onChange={(e) => handleCustomFieldChange('instrument', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Duration (Minutes)</label>
              <select
                className="form-control"
                required
                value={customForm.duration_minutes}
                onChange={(e) => handleCustomFieldChange('duration_minutes', Number(e.target.value))}
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Custom Student Fee ($/month)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                required
                value={customForm.custom_student_fee}
                onChange={(e) => handleCustomFieldChange('custom_student_fee', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Custom Teacher Pay ($/month)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                required
                value={customForm.custom_teacher_rate}
                onChange={(e) => handleCustomFieldChange('custom_teacher_rate', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason / Notes</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Sibling discount / special scholarship"
              value={customForm.notes}
              onChange={(e) => handleCustomFieldChange('notes', e.target.value)}
            />
          </div>

          <div className="modal-actions mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setIsCustomModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingCustomRate ? 'Save Changes' : 'Save Custom Override'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
