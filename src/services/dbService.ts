// @ts-nocheck
import { generateUUID } from '../utils/id';

class DBService {
  constructor() {
    this.worker = null;
    this.messageId = 0;
    this.pendingResolvers = new Map();
    this.initialized = false;
    this.initPromise = null;
  }

  init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(new URL('./db.worker.ts', import.meta.url), { type: 'module' });

        this.worker.onmessage = (e) => {
          const { id, success, data, error } = e.data;
          const resolver = this.pendingResolvers.get(id);
          if (resolver) {
            this.pendingResolvers.delete(id);
            if (success) {
              resolver.resolve(data);
            } else {
              resolver.reject(new Error(error));
            }
          }
        };

        this.worker.onerror = (err) => {
          console.error('Database worker error:', err);
          reject(err);
        };

        // Send INIT
        this.send('INIT')
          .then((res) => {
            this.initialized = true;
            resolve(res);
          })
          .catch(reject);
      } catch (err) {
        console.error('Failed to create DB worker:', err);
        reject(err);
      }
    });

    return this.initPromise;
  }

  send(type, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pendingResolvers.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload });
    });
  }

  async query(sql, bind = []) {
    await this.init();
    return await this.send('QUERY', { sql, bind });
  }

  async exec(sql, bind = []) {
    await this.init();
    return await this.send('EXEC', { sql, bind });
  }

  async saveToOPFS() {
    await this.init();
    const res = await this.send('SAVE_TO_OPFS');
    const now = new Date().toISOString();
    await this.setSetting('last_local_save', now);
    return { ...res, timestamp: now };
  }

  async exportBinary() {
    await this.init();
    return await this.send('EXPORT_BINARY');
  }

  async importBinary(uint8Array) {
    await this.init();
    const res = await this.send('IMPORT_BINARY', { binary: uint8Array });
    const now = new Date().toISOString();
    await this.setSetting('last_local_save', now);
    return res;
  }

  async mergeRemote(uint8Array) {
    await this.init();
    const res = await this.send('MERGE_REMOTE', { binary: uint8Array });
    const now = new Date().toISOString();
    await this.setSetting('last_local_save', now);
    return res;
  }

  // --- App Settings Helper ---
  async getSetting(key, defaultValue = null) {
    const rows = await this.query(`SELECT value FROM app_settings WHERE key = ?`, [key]);
    return rows.length > 0 ? rows[0].value : defaultValue;
  }

  async setSetting(key, value) {
    const now = new Date().toISOString();
    await this.exec(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
      [key, String(value), now]
    );
  }

  // --- Students ---
  async getStudents() {
    return await this.query(`
      SELECT * FROM students 
      WHERE deleted_at IS NULL 
      ORDER BY full_name ASC;
    `);
  }

  async saveStudent(student) {
    const now = new Date().toISOString();
    const id = student.id || generateUUID();
    const isNew = !student.id;

    if (isNew) {
      await this.exec(`
        INSERT INTO students (id, ic, full_name, preferred_name, birthday, phone, email, emergency_contact, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        id,
        student.ic.trim(),
        student.full_name.trim(),
        (student.preferred_name || '').trim() || null,
        student.birthday,
        student.phone || null,
        student.email || null,
        student.emergency_contact || null,
        student.status || 'active',
        now,
        now
      ]);
    } else {
      await this.exec(`
        UPDATE students SET 
          ic = ?, 
          full_name = ?, 
          preferred_name = ?, 
          birthday = ?, 
          phone = ?, 
          email = ?, 
          emergency_contact = ?, 
          status = ?, 
          updated_at = ?
        WHERE id = ?;
      `, [
        student.ic.trim(),
        student.full_name.trim(),
        (student.preferred_name || '').trim() || null,
        student.birthday,
        student.phone || null,
        student.email || null,
        student.emergency_contact || null,
        student.status || 'active',
        now,
        id
      ]);
    }
    return id;
  }

  async deleteStudent(id) {
    const now = new Date().toISOString();
    await this.exec(`UPDATE students SET deleted_at = ?, updated_at = ? WHERE id = ?;`, [now, now, id]);
  }

  // --- Teachers & Qualifications ---
  async getTeachers() {
    return await this.query(`
      SELECT * FROM teachers 
      WHERE deleted_at IS NULL 
      ORDER BY full_name ASC;
    `);
  }

  async saveTeacher(teacher) {
    const now = new Date().toISOString();
    const id = teacher.id || generateUUID();
    const isNew = !teacher.id;

    if (isNew) {
      await this.exec(`
        INSERT INTO teachers (id, ic, full_name, preferred_name, birthday, phone, email, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        id,
        teacher.ic.trim(),
        teacher.full_name.trim(),
        (teacher.preferred_name || '').trim() || null,
        teacher.birthday,
        teacher.phone || null,
        teacher.email || null,
        teacher.status || 'active',
        now,
        now
      ]);
    } else {
      await this.exec(`
        UPDATE teachers SET 
          ic = ?, 
          full_name = ?, 
          preferred_name = ?, 
          birthday = ?, 
          phone = ?, 
          email = ?, 
          status = ?, 
          updated_at = ?
        WHERE id = ?;
      `, [
        teacher.ic.trim(),
        teacher.full_name.trim(),
        (teacher.preferred_name || '').trim() || null,
        teacher.birthday,
        teacher.phone || null,
        teacher.email || null,
        teacher.status || 'active',
        now,
        id
      ]);
    }
    return id;
  }

  async deleteTeacher(id) {
    const now = new Date().toISOString();
    await this.exec(`UPDATE teachers SET deleted_at = ?, updated_at = ? WHERE id = ?;`, [now, now, id]);
    // Also soft delete qualifications
    await this.exec(`UPDATE teacher_qualifications SET deleted_at = ?, updated_at = ? WHERE teacher_id = ?;`, [now, now, id]);
  }

  async getTeacherQualifications(teacherId = null) {
    if (teacherId) {
      return await this.query(`
        SELECT tq.*, tc.name as category_name
        FROM teacher_qualifications tq
        LEFT JOIN teacher_categories tc ON tq.category_id = tc.id
        WHERE tq.teacher_id = ? AND tq.deleted_at IS NULL
        ORDER BY tq.instrument ASC;
      `, [teacherId]);
    }
    return await this.query(`
      SELECT tq.*, tc.name as category_name, t.full_name as teacher_name
      FROM teacher_qualifications tq
      JOIN teachers t ON tq.teacher_id = t.id
      LEFT JOIN teacher_categories tc ON tq.category_id = tc.id
      WHERE tq.deleted_at IS NULL AND t.deleted_at IS NULL
      ORDER BY t.full_name ASC, tq.instrument ASC;
    `);
  }

  async saveTeacherQualification(qual) {
    const now = new Date().toISOString();
    const id = qual.id || generateUUID();
    const isNew = !qual.id;

    if (isNew) {
      await this.exec(`
        INSERT INTO teacher_qualifications (id, teacher_id, instrument, certificate, category_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `, [
        id,
        qual.teacher_id,
        qual.instrument.trim(),
        qual.certificate.trim(),
        qual.category_id,
        now,
        now
      ]);
    } else {
      await this.exec(`
        UPDATE teacher_qualifications SET 
          instrument = ?, 
          certificate = ?, 
          category_id = ?, 
          updated_at = ?
        WHERE id = ?;
      `, [
        qual.instrument.trim(),
        qual.certificate.trim(),
        qual.category_id,
        now,
        id
      ]);
    }
    return id;
  }

  async deleteTeacherQualification(id) {
    const now = new Date().toISOString();
    await this.exec(`UPDATE teacher_qualifications SET deleted_at = ?, updated_at = ? WHERE id = ?;`, [now, now, id]);
  }

  // --- Categories & Rate Templates ---
  async getCategories() {
    return await this.query(`
      SELECT * FROM teacher_categories 
      WHERE deleted_at IS NULL 
      ORDER BY instrument ASC, name ASC;
    `);
  }

  async saveCategory(cat) {
    const now = new Date().toISOString();
    const id = cat.id || generateUUID();
    const isNew = !cat.id;

    if (isNew) {
      await this.exec(`
        INSERT INTO teacher_categories (id, name, instrument, certificate, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?);
      `, [id, cat.name.trim(), cat.instrument.trim(), cat.certificate.trim(), now, now]);
    } else {
      await this.exec(`
        UPDATE teacher_categories SET 
          name = ?, 
          instrument = ?, 
          certificate = ?, 
          updated_at = ?
        WHERE id = ?;
      `, [cat.name.trim(), cat.instrument.trim(), cat.certificate.trim(), now, id]);
    }
    return id;
  }

  async deleteCategory(id) {
    const now = new Date().toISOString();
    await this.exec(`UPDATE teacher_categories SET deleted_at = ?, updated_at = ? WHERE id = ?;`, [now, now, id]);
    await this.exec(`UPDATE rate_templates SET deleted_at = ?, updated_at = ? WHERE category_id = ?;`, [now, now, id]);
  }

  async getRateTemplates(categoryId = null) {
    if (categoryId) {
      return await this.query(`
        SELECT rt.*, tc.name as category_name, tc.instrument 
        FROM rate_templates rt
        JOIN teacher_categories tc ON rt.category_id = tc.id
        WHERE rt.category_id = ? AND rt.deleted_at IS NULL
        ORDER BY rt.grade ASC, rt.duration_minutes ASC;
      `, [categoryId]);
    }
    return await this.query(`
      SELECT rt.*, tc.name as category_name, tc.instrument 
      FROM rate_templates rt
      JOIN teacher_categories tc ON rt.category_id = tc.id
      WHERE rt.deleted_at IS NULL AND tc.deleted_at IS NULL
      ORDER BY tc.name ASC, rt.grade ASC, rt.duration_minutes ASC;
    `);
  }

  async saveRateTemplate(tpl) {
    const now = new Date().toISOString();
    const id = tpl.id || generateUUID();
    const isNew = !tpl.id;

    if (isNew) {
      await this.exec(`
        INSERT INTO rate_templates (id, category_id, grade, duration_minutes, default_student_fee, default_teacher_rate, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        id,
        tpl.category_id,
        tpl.grade.trim(),
        Number(tpl.duration_minutes),
        Number(tpl.default_student_fee),
        Number(tpl.default_teacher_rate),
        now,
        now
      ]);
    } else {
      await this.exec(`
        UPDATE rate_templates SET 
          category_id = ?, 
          grade = ?, 
          duration_minutes = ?, 
          default_student_fee = ?, 
          default_teacher_rate = ?, 
          updated_at = ?
        WHERE id = ?;
      `, [
        tpl.category_id,
        tpl.grade.trim(),
        Number(tpl.duration_minutes),
        Number(tpl.default_student_fee),
        Number(tpl.default_teacher_rate),
        now,
        id
      ]);
    }
    return id;
  }

  // --- Customized Rates ---
  async getCustomizedRates() {
    return await this.query(`
      SELECT cr.*, s.full_name as student_name, t.full_name as teacher_name
      FROM customized_rates cr
      JOIN students s ON cr.student_id = s.id
      JOIN teachers t ON cr.teacher_id = t.id
      WHERE cr.deleted_at IS NULL AND s.deleted_at IS NULL AND t.deleted_at IS NULL
      ORDER BY s.full_name ASC;
    `);
  }

  async saveCustomizedRate(cr) {
    const now = new Date().toISOString();
    const id = cr.id || generateUUID();
    const isNew = !cr.id;

    if (isNew) {
      await this.exec(`
        INSERT INTO customized_rates (id, student_id, teacher_id, instrument, duration_minutes, custom_student_fee, custom_teacher_rate, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        id,
        cr.student_id,
        cr.teacher_id,
        cr.instrument.trim(),
        Number(cr.duration_minutes),
        Number(cr.custom_student_fee),
        Number(cr.custom_teacher_rate),
        cr.notes || null,
        now,
        now
      ]);
    } else {
      await this.exec(`
        UPDATE customized_rates SET 
          student_id = ?, 
          teacher_id = ?, 
          instrument = ?, 
          duration_minutes = ?, 
          custom_student_fee = ?, 
          custom_teacher_rate = ?, 
          notes = ?, 
          updated_at = ?
        WHERE id = ?;
      `, [
        cr.student_id,
        cr.teacher_id,
        cr.instrument.trim(),
        Number(cr.duration_minutes),
        Number(cr.custom_student_fee),
        Number(cr.custom_teacher_rate),
        cr.notes || null,
        now,
        id
      ]);
    }
    return id;
  }

  async deleteCustomizedRate(id) {
    const now = new Date().toISOString();
    await this.exec(`UPDATE customized_rates SET deleted_at = ?, updated_at = ? WHERE id = ?;`, [now, now, id]);
  }

  // Lookup default or customized rate for lesson creation
  async lookupLessonRate({ studentId, teacherId, instrument, grade, durationMinutes }) {
    // 1. Check for student-specific customized rate first
    const custom = await this.query(`
      SELECT * FROM customized_rates 
      WHERE student_id = ? AND teacher_id = ? AND instrument = ? AND duration_minutes = ? AND deleted_at IS NULL
      LIMIT 1;
    `, [studentId, teacherId, instrument, Number(durationMinutes)]);

    if (custom.length > 0) {
      return {
        isCustom: true,
        customRateId: custom[0].id,
        studentFee: custom[0].custom_student_fee,
        teacherRate: custom[0].custom_teacher_rate,
        source: 'Customized Rate Override'
      };
    }

    // 2. Lookup teacher's category for this instrument
    const qual = await this.query(`
      SELECT tq.category_id, tc.name as category_name
      FROM teacher_qualifications tq
      JOIN teacher_categories tc ON tq.category_id = tc.id
      WHERE tq.teacher_id = ? AND tq.instrument = ? AND tq.deleted_at IS NULL
      LIMIT 1;
    `, [teacherId, instrument]);

    if (qual.length > 0) {
      const categoryId = qual[0].category_id;
      const tpl = await this.query(`
        SELECT * FROM rate_templates 
        WHERE category_id = ? AND grade = ? AND duration_minutes = ? AND deleted_at IS NULL
        LIMIT 1;
      `, [categoryId, grade, Number(durationMinutes)]);

      if (tpl.length > 0) {
        return {
          isCustom: false,
          customRateId: null,
          studentFee: tpl[0].default_student_fee,
          teacherRate: tpl[0].default_teacher_rate,
          source: `Template: ${qual[0].category_name} (${grade}, ${durationMinutes}m)`
        };
      }
    }

    // Fallback default
    return {
      isCustom: false,
      customRateId: null,
      studentFee: 150,
      teacherRate: 90,
      source: 'Default Base Rate'
    };
  }

  // --- Monthly Scheduled Lessons ---
  async getMonthlyLessons() {
    return await this.query(`
      SELECT msl.*, 
        s.full_name as student_name, s.ic as student_ic,
        t.full_name as teacher_name, t.ic as teacher_ic
      FROM monthly_scheduled_lessons msl
      JOIN students s ON msl.student_id = s.id
      JOIN teachers t ON msl.teacher_id = t.id
      WHERE msl.deleted_at IS NULL AND s.deleted_at IS NULL AND t.deleted_at IS NULL
      ORDER BY msl.day_of_week ASC, msl.start_time ASC;
    `);
  }

  async saveMonthlyLesson(lesson) {
    const now = new Date().toISOString();
    const id = lesson.id || generateUUID();
    const isNew = !lesson.id;

    if (isNew) {
      await this.exec(`
        INSERT INTO monthly_scheduled_lessons (
          id, student_id, teacher_id, instrument, grade, day_of_week, start_time, 
          duration_minutes, monthly_student_fee, monthly_teacher_rate, is_custom_rate, 
          customized_rate_id, start_date, end_date, status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        id,
        lesson.student_id,
        lesson.teacher_id,
        lesson.instrument.trim(),
        lesson.grade.trim(),
        Number(lesson.day_of_week),
        lesson.start_time.trim(),
        Number(lesson.duration_minutes),
        Number(lesson.monthly_student_fee),
        Number(lesson.monthly_teacher_rate),
        lesson.is_custom_rate ? 1 : 0,
        lesson.customized_rate_id || null,
        lesson.start_date,
        lesson.end_date || null,
        lesson.status || 'active',
        now,
        now
      ]);
    } else {
      await this.exec(`
        UPDATE monthly_scheduled_lessons SET 
          student_id = ?, 
          teacher_id = ?, 
          instrument = ?, 
          grade = ?, 
          day_of_week = ?, 
          start_time = ?, 
          duration_minutes = ?, 
          monthly_student_fee = ?, 
          monthly_teacher_rate = ?, 
          is_custom_rate = ?, 
          customized_rate_id = ?, 
          start_date = ?, 
          end_date = ?, 
          status = ?, 
          updated_at = ?
        WHERE id = ?;
      `, [
        lesson.student_id,
        lesson.teacher_id,
        lesson.instrument.trim(),
        lesson.grade.trim(),
        Number(lesson.day_of_week),
        lesson.start_time.trim(),
        Number(lesson.duration_minutes),
        Number(lesson.monthly_student_fee),
        Number(lesson.monthly_teacher_rate),
        lesson.is_custom_rate ? 1 : 0,
        lesson.customized_rate_id || null,
        lesson.start_date,
        lesson.end_date || null,
        lesson.status || 'active',
        now,
        id
      ]);
    }
    return id;
  }

  async deleteMonthlyLesson(id) {
    const now = new Date().toISOString();
    await this.exec(`UPDATE monthly_scheduled_lessons SET deleted_at = ?, updated_at = ? WHERE id = ?;`, [now, now, id]);
  }

  // --- Adhoc Lessons ---
  async getAdhocLessons() {
    return await this.query(`
      SELECT al.*, 
        s.full_name as student_name, s.ic as student_ic,
        t.full_name as teacher_name, t.ic as teacher_ic
      FROM adhoc_lessons al
      JOIN students s ON al.student_id = s.id
      JOIN teachers t ON al.teacher_id = t.id
      WHERE al.deleted_at IS NULL AND s.deleted_at IS NULL AND t.deleted_at IS NULL
      ORDER BY al.lesson_date DESC, al.start_time DESC;
    `);
  }

  async saveAdhocLesson(adhoc) {
    const now = new Date().toISOString();
    const id = adhoc.id || generateUUID();
    const isNew = !adhoc.id;

    if (isNew) {
      await this.exec(`
        INSERT INTO adhoc_lessons (
          id, student_id, teacher_id, instrument, lesson_date, start_time, 
          duration_minutes, student_fee, teacher_pay, status, notes, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        id,
        adhoc.student_id,
        adhoc.teacher_id,
        adhoc.instrument.trim(),
        adhoc.lesson_date,
        adhoc.start_time.trim(),
        Number(adhoc.duration_minutes),
        Number(adhoc.student_fee),
        Number(adhoc.teacher_pay),
        adhoc.status || 'scheduled',
        adhoc.notes || null,
        now,
        now
      ]);
    } else {
      await this.exec(`
        UPDATE adhoc_lessons SET 
          student_id = ?, 
          teacher_id = ?, 
          instrument = ?, 
          lesson_date = ?, 
          start_time = ?, 
          duration_minutes = ?, 
          student_fee = ?, 
          teacher_pay = ?, 
          status = ?, 
          notes = ?, 
          updated_at = ?
        WHERE id = ?;
      `, [
        adhoc.student_id,
        adhoc.teacher_id,
        adhoc.instrument.trim(),
        adhoc.lesson_date,
        adhoc.start_time.trim(),
        Number(adhoc.duration_minutes),
        Number(adhoc.student_fee),
        Number(adhoc.teacher_pay),
        adhoc.status || 'scheduled',
        adhoc.notes || null,
        now,
        id
      ]);
    }
    return id;
  }

  async deleteAdhocLesson(id) {
    const now = new Date().toISOString();
    await this.exec(`UPDATE adhoc_lessons SET deleted_at = ?, updated_at = ? WHERE id = ?;`, [now, now, id]);
  }

  // --- Student Payments (Historical Financial Ledger) ---
  async getStudentPayments() {
    return await this.query(`
      SELECT sp.*, 
        s.full_name as student_name, s.ic as student_ic,
        msl.instrument as monthly_instrument,
        al.instrument as adhoc_instrument, al.lesson_date as adhoc_date
      FROM student_payments sp
      JOIN students s ON sp.student_id = s.id
      LEFT JOIN monthly_scheduled_lessons msl ON sp.monthly_lesson_id = msl.id
      LEFT JOIN adhoc_lessons al ON sp.adhoc_lesson_id = al.id
      WHERE sp.deleted_at IS NULL AND s.deleted_at IS NULL
      ORDER BY sp.payment_date DESC, sp.created_at DESC;
    `);
  }

  async saveStudentPayment(pay) {
    const now = new Date().toISOString();
    const id = pay.id || generateUUID();
    const isNew = !pay.id;

    if (isNew) {
      await this.exec(`
        INSERT INTO student_payments (
          id, student_id, payment_date, amount_paid, payment_type, billing_period,
          monthly_lesson_id, adhoc_lesson_id, payment_method, receipt_no, notes, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        id,
        pay.student_id,
        pay.payment_date,
        Number(pay.amount_paid), // Snapshot amount
        pay.payment_type,
        pay.billing_period || null,
        pay.monthly_lesson_id || null,
        pay.adhoc_lesson_id || null,
        pay.payment_method || 'Cash',
        pay.receipt_no || null,
        pay.notes || null,
        now,
        now
      ]);
    } else {
      await this.exec(`
        UPDATE student_payments SET 
          student_id = ?, 
          payment_date = ?, 
          amount_paid = ?, 
          payment_type = ?, 
          billing_period = ?, 
          monthly_lesson_id = ?, 
          adhoc_lesson_id = ?, 
          payment_method = ?, 
          receipt_no = ?, 
          notes = ?, 
          updated_at = ?
        WHERE id = ?;
      `, [
        pay.student_id,
        pay.payment_date,
        Number(pay.amount_paid),
        pay.payment_type,
        pay.billing_period || null,
        pay.monthly_lesson_id || null,
        pay.adhoc_lesson_id || null,
        pay.payment_method || 'Cash',
        pay.receipt_no || null,
        pay.notes || null,
        now,
        id
      ]);
    }
    return id;
  }

  async deleteStudentPayment(id) {
    const now = new Date().toISOString();
    await this.exec(`UPDATE student_payments SET deleted_at = ?, updated_at = ? WHERE id = ?;`, [now, now, id]);
  }

  // --- Teacher Salaries (Historical Financial Disbursements) ---
  async getTeacherSalaries() {
    return await this.query(`
      SELECT ts.*, 
        t.full_name as teacher_name, t.ic as teacher_ic,
        msl.instrument as monthly_instrument,
        al.instrument as adhoc_instrument, al.lesson_date as adhoc_date
      FROM teacher_salaries ts
      JOIN teachers t ON ts.teacher_id = t.id
      LEFT JOIN monthly_scheduled_lessons msl ON ts.monthly_lesson_id = msl.id
      LEFT JOIN adhoc_lessons al ON ts.adhoc_lesson_id = al.id
      WHERE ts.deleted_at IS NULL AND t.deleted_at IS NULL
      ORDER BY ts.payout_date DESC, ts.created_at DESC;
    `);
  }

  async saveTeacherSalary(sal) {
    const now = new Date().toISOString();
    const id = sal.id || generateUUID();
    const isNew = !sal.id;

    if (isNew) {
      await this.exec(`
        INSERT INTO teacher_salaries (
          id, teacher_id, payout_date, amount_paid, salary_type, period,
          monthly_lesson_id, adhoc_lesson_id, payment_method, voucher_no, notes, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        id,
        sal.teacher_id,
        sal.payout_date,
        Number(sal.amount_paid), // Snapshot salary amount
        sal.salary_type,
        sal.period,
        sal.monthly_lesson_id || null,
        sal.adhoc_lesson_id || null,
        sal.payment_method || 'Bank Transfer',
        sal.voucher_no || null,
        sal.notes || null,
        now,
        now
      ]);
    } else {
      await this.exec(`
        UPDATE teacher_salaries SET 
          teacher_id = ?, 
          payout_date = ?, 
          amount_paid = ?, 
          salary_type = ?, 
          period = ?, 
          monthly_lesson_id = ?, 
          adhoc_lesson_id = ?, 
          payment_method = ?, 
          voucher_no = ?, 
          notes = ?, 
          updated_at = ?
        WHERE id = ?;
      `, [
        sal.teacher_id,
        sal.payout_date,
        Number(sal.amount_paid),
        sal.salary_type,
        sal.period,
        sal.monthly_lesson_id || null,
        sal.adhoc_lesson_id || null,
        sal.payment_method || 'Bank Transfer',
        sal.voucher_no || null,
        sal.notes || null,
        now,
        id
      ]);
    }
    return id;
  }

  async deleteTeacherSalary(id) {
    const now = new Date().toISOString();
    await this.exec(`UPDATE teacher_salaries SET deleted_at = ?, updated_at = ? WHERE id = ?;`, [now, now, id]);
  }
}

export const dbService = new DBService();
