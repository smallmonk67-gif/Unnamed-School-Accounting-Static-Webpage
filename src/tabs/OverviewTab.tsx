// @ts-nocheck
import React from 'react';
import Timetable from '../components/Timetable';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/dates';
import { 
  Users, 
  GraduationCap, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  ArrowRight,
  Music
} from 'lucide-react';

export default function OverviewTab({ 
  students = [], 
  teachers = [], 
  lessons = [], 
  adhocLessons = [], 
  payments = [], 
  salaries = [],
  onSelectTab,
  onEditLesson
}) {
  const activeStudents = students.filter(s => s.status === 'active');
  const activeTeachers = teachers.filter(t => t.status === 'active');
  const activeLessons = lessons.filter(l => l.status === 'active');

  // Calculate monthly recurring fee revenue
  const monthlyRevenue = activeLessons.reduce((sum, l) => sum + Number(l.monthly_student_fee || 0), 0);
  const monthlyTeacherPay = activeLessons.reduce((sum, l) => sum + Number(l.monthly_teacher_rate || 0), 0);

  // Total collected payments
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  // Total salaries paid
  const totalSalariesPaid = salaries.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);

  // Recent 5 payments
  const recentPayments = payments.slice(0, 5);
  // Upcoming 5 adhoc lessons
  const upcomingAdhoc = adhocLessons
    .filter(a => a.status === 'scheduled')
    .slice(0, 5);

  return (
    <div className="tab-pane-content">
      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Students</span>
            <div className="metric-icon-wrap purple"><Users size={20} /></div>
          </div>
          <div className="metric-value">{activeStudents.length}</div>
          <div className="metric-footer">Total enrolled students</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Teachers</span>
            <div className="metric-icon-wrap blue"><GraduationCap size={20} /></div>
          </div>
          <div className="metric-value">{activeTeachers.length}</div>
          <div className="metric-footer">Music faculty staff</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Weekly Lessons</span>
            <div className="metric-icon-wrap green"><Calendar size={20} /></div>
          </div>
          <div className="metric-value">{activeLessons.length}</div>
          <div className="metric-footer">Active recurring slots</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Monthly Revenue Due</span>
            <div className="metric-icon-wrap emerald"><DollarSign size={20} /></div>
          </div>
          <div className="metric-value">{formatCurrency(monthlyRevenue)}</div>
          <div className="metric-footer">Est. teacher pay: {formatCurrency(monthlyTeacherPay)}</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Payments Collected</span>
            <div className="metric-icon-wrap orange"><TrendingUp size={20} /></div>
          </div>
          <div className="metric-value">{formatCurrency(totalCollected)}</div>
          <div className="metric-footer">Salaries paid: {formatCurrency(totalSalariesPaid)}</div>
        </div>
      </div>

      {/* Main Section: Interactive Weekly Timetable */}
      <div className="content-card mt-6">
        <div className="card-header-flex">
          <div>
            <h3 className="card-title">School Timetable & Schedule</h3>
            <p className="card-subtitle">Weekly scheduled recurring lesson allocations for students and teachers</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => onSelectTab('lessons')}>
            Manage All Lessons <ArrowRight size={14} />
          </button>
        </div>

        <Timetable 
          lessons={lessons} 
          students={students} 
          teachers={teachers} 
          onEditLesson={onEditLesson} 
        />
      </div>

      {/* Two Column Grid: Upcoming Adhoc Lessons & Recent Payments */}
      <div className="grid-2-cols mt-6">
        {/* Upcoming Adhoc Lessons */}
        <div className="content-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-title">Upcoming Adhoc Sessions</h3>
              <p className="card-subtitle">One-off scheduled lessons</p>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => onSelectTab('lessons')}>
              View All
            </button>
          </div>

          {upcomingAdhoc.length === 0 ? (
            <div className="empty-state-box">
              <Clock size={32} className="empty-icon" />
              <p>No upcoming adhoc lessons scheduled.</p>
            </div>
          ) : (
            <div className="list-group">
              {upcomingAdhoc.map((item) => (
                <div key={item.id} className="list-item-row">
                  <div className="list-item-main">
                    <strong>{item.student_name}</strong> with {item.teacher_name}
                    <div className="list-item-sub">
                      <Music size={12} /> {item.instrument} • {formatDate(item.lesson_date)} at {item.start_time} ({item.duration_minutes}m)
                    </div>
                  </div>
                  <div className="list-item-right">
                    <span className="badge badge-success">{formatCurrency(item.student_fee)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="content-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-title">Recent Fee Payments</h3>
              <p className="card-subtitle">Latest student receipts recorded</p>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => onSelectTab('payments')}>
              View Ledger
            </button>
          </div>

          {recentPayments.length === 0 ? (
            <div className="empty-state-box">
              <DollarSign size={32} className="empty-icon" />
              <p>No student payments recorded yet.</p>
            </div>
          ) : (
            <div className="list-group">
              {recentPayments.map((pay) => (
                <div key={pay.id} className="list-item-row">
                  <div className="list-item-main">
                    <strong>{pay.student_name}</strong>
                    <div className="list-item-sub">
                      {formatDate(pay.payment_date)} • {pay.payment_method} {pay.receipt_no ? `• #${pay.receipt_no}` : ''}
                    </div>
                  </div>
                  <div className="list-item-right">
                    <span className="font-semibold text-success">{formatCurrency(pay.amount_paid)}</span>
                    <span className="badge badge-muted ml-2">{pay.payment_type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
