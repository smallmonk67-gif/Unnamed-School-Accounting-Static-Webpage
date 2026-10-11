// @ts-nocheck
import * as XLSX from 'xlsx';
import { dbService } from './dbService';
import { getDayName } from '../utils/dates';

export async function exportAllDataToExcel() {
  // 1. Fetch data from SQLite
  const students = await dbService.getStudents();
  const teachers = await dbService.getTeachers();
  const qualifications = await dbService.getTeacherQualifications();
  const monthlyLessons = await dbService.getMonthlyLessons();
  const adhocLessons = await dbService.getAdhocLessons();
  const studentPayments = await dbService.getStudentPayments();
  const teacherSalaries = await dbService.getTeacherSalaries();
  const categories = await dbService.getCategories();
  const rateTemplates = await dbService.getRateTemplates();
  const customizedRates = await dbService.getCustomizedRates();

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Students
  const studentsData = students.map((s) => ({
    'ID': s.id,
    'IC / National ID': s.ic,
    'Full Name': s.full_name,
    'Preferred Name': s.preferred_name || '',
    'Birthday': s.birthday,
    'Phone': s.phone || '',
    'Email': s.email || '',
    'Emergency Contact': s.emergency_contact || '',
    'Status': s.status,
    'Created At': s.created_at
  }));
  const wsStudents = XLSX.utils.json_to_sheet(studentsData);
  XLSX.utils.book_append_sheet(wb, wsStudents, 'Students');

  // Sheet 2: Teachers
  const teachersData = teachers.map((t) => ({
    'ID': t.id,
    'IC / National ID': t.ic,
    'Full Name': t.full_name,
    'Preferred Name': t.preferred_name || '',
    'Birthday': t.birthday,
    'Phone': t.phone || '',
    'Email': t.email || '',
    'Status': t.status,
    'Created At': t.created_at
  }));
  const wsTeachers = XLSX.utils.json_to_sheet(teachersData);
  XLSX.utils.book_append_sheet(wb, wsTeachers, 'Teachers');

  // Sheet 3: Teacher Qualifications
  const qualsData = qualifications.map((q) => ({
    'Teacher Name': q.teacher_name,
    'Instrument': q.instrument,
    'Certificate': q.certificate,
    'Assigned Category': q.category_name || '',
    'Created At': q.created_at
  }));
  const wsQuals = XLSX.utils.json_to_sheet(qualsData);
  XLSX.utils.book_append_sheet(wb, wsQuals, 'Qualifications');

  // Sheet 4: Scheduled Lessons (Monthly)
  const lessonsData = monthlyLessons.map((l) => ({
    'Lesson ID': l.id,
    'Student Name': l.student_name,
    'Student IC': l.student_ic,
    'Teacher Name': l.teacher_name,
    'Teacher IC': l.teacher_ic,
    'Instrument': l.instrument,
    'Grade': l.grade,
    'Day of Week': getDayName(l.day_of_week),
    'Start Time': l.start_time,
    'Duration (Mins)': l.duration_minutes,
    'Monthly Student Fee ($)': l.monthly_student_fee,
    'Monthly Teacher Pay ($)': l.monthly_teacher_rate,
    'Custom Rate Override': l.is_custom_rate ? 'Yes' : 'No',
    'Start Date': l.start_date,
    'End Date': l.end_date || 'Ongoing',
    'Status': l.status
  }));
  const wsLessons = XLSX.utils.json_to_sheet(lessonsData);
  XLSX.utils.book_append_sheet(wb, wsLessons, 'Scheduled Lessons');

  // Sheet 5: Adhoc Lessons
  const adhocData = adhocLessons.map((a) => ({
    'Session ID': a.id,
    'Date': a.lesson_date,
    'Start Time': a.start_time,
    'Duration (Mins)': a.duration_minutes,
    'Student Name': a.student_name,
    'Student IC': a.student_ic,
    'Teacher Name': a.teacher_name,
    'Teacher IC': a.teacher_ic,
    'Instrument': a.instrument,
    'Student Fee ($)': a.student_fee,
    'Teacher Pay ($)': a.teacher_pay,
    'Status': a.status,
    'Notes': a.notes || ''
  }));
  const wsAdhoc = XLSX.utils.json_to_sheet(adhocData);
  XLSX.utils.book_append_sheet(wb, wsAdhoc, 'Adhoc Lessons');

  // Sheet 6: Student Payments (Snapshot amounts)
  const paymentsData = studentPayments.map((p) => ({
    'Payment ID': p.id,
    'Receipt No': p.receipt_no || '',
    'Date Paid': p.payment_date,
    'Student Name': p.student_name,
    'Student IC': p.student_ic,
    'Amount Paid ($)': p.amount_paid,
    'Payment Type': p.payment_type,
    'Billing Period': p.billing_period || '',
    'Payment Method': p.payment_method,
    'Notes': p.notes || ''
  }));
  const wsPayments = XLSX.utils.json_to_sheet(paymentsData);
  XLSX.utils.book_append_sheet(wb, wsPayments, 'Student Payments');

  // Sheet 7: Teacher Salaries (Snapshot amounts)
  const salariesData = teacherSalaries.map((s) => ({
    'Salary ID': s.id,
    'Voucher No': s.voucher_no || '',
    'Payout Date': s.payout_date,
    'Teacher Name': s.teacher_name,
    'Teacher IC': s.teacher_ic,
    'Amount Paid ($)': s.amount_paid,
    'Salary Type': s.salary_type,
    'Period': s.period,
    'Payment Method': s.payment_method,
    'Notes': s.notes || ''
  }));
  const wsSalaries = XLSX.utils.json_to_sheet(salariesData);
  XLSX.utils.book_append_sheet(wb, wsSalaries, 'Teacher Salaries');

  // Sheet 8: Rate Templates
  const templatesData = rateTemplates.map((t) => ({
    'Category Name': t.category_name,
    'Instrument': t.instrument,
    'Grade': t.grade,
    'Duration (Mins)': t.duration_minutes,
    'Default Student Fee ($)': t.default_student_fee,
    'Default Teacher Rate ($)': t.default_teacher_rate
  }));
  const wsTemplates = XLSX.utils.json_to_sheet(templatesData);
  XLSX.utils.book_append_sheet(wb, wsTemplates, 'Rate Templates');

  // Sheet 9: Customized Rates
  const customData = customizedRates.map((c) => ({
    'Student Name': c.student_name,
    'Teacher Name': c.teacher_name,
    'Instrument': c.instrument,
    'Duration (Mins)': c.duration_minutes,
    'Custom Student Fee ($)': c.custom_student_fee,
    'Custom Teacher Rate ($)': c.custom_teacher_rate,
    'Notes': c.notes || ''
  }));
  const wsCustom = XLSX.utils.json_to_sheet(customData);
  XLSX.utils.book_append_sheet(wb, wsCustom, 'Customized Rates');

  // Generate filename with date
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `MusicSchool_Accounting_${dateStr}.xlsx`;

  // Write and trigger download
  XLSX.writeFile(wb, filename);
  return filename;
}
