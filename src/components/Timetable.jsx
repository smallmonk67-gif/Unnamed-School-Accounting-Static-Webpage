import React, { useState } from 'react';
import { DAYS_OF_WEEK, getDayName } from '../utils/dates';
import { formatCurrency } from '../utils/currency';
import { Calendar, Clock, User, Music, Edit3 } from 'lucide-react';

export default function Timetable({ lessons = [], students = [], teachers = [], onEditLesson }) {
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'teacher', 'student'
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Filter lessons
  const filteredLessons = lessons.filter((l) => {
    if (l.status !== 'active') return false;
    if (filterMode === 'teacher' && selectedTeacherId && l.teacher_id !== selectedTeacherId) {
      return false;
    }
    if (filterMode === 'student' && selectedStudentId && l.student_id !== selectedStudentId) {
      return false;
    }
    return true;
  });

  // Group by day of week (1 to 7)
  const lessonsByDay = {};
  for (let d = 1; d <= 7; d++) {
    lessonsByDay[d] = [];
  }
  for (const l of filteredLessons) {
    const day = Number(l.day_of_week);
    if (lessonsByDay[day]) {
      lessonsByDay[day].push(l);
    }
  }

  // Sort lessons within each day by start_time
  for (let d = 1; d <= 7; d++) {
    lessonsByDay[d].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  return (
    <div className="timetable-container">
      <div className="timetable-controls">
        <div className="timetable-filter-group">
          <label className="filter-label">Filter Timetable View:</label>
          <div className="filter-btn-group">
            <button
              className={`btn btn-sm ${filterMode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setFilterMode('all'); setSelectedTeacherId(''); setSelectedStudentId(''); }}
            >
              All Lessons ({filteredLessons.length})
            </button>
            <button
              className={`btn btn-sm ${filterMode === 'teacher' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterMode('teacher')}
            >
              By Teacher
            </button>
            <button
              className={`btn btn-sm ${filterMode === 'student' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterMode('student')}
            >
              By Student
            </button>
          </div>
        </div>

        {filterMode === 'teacher' && (
          <div className="timetable-select-filter">
            <select
              className="form-control"
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
            >
              <option value="">-- Select a Teacher --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.ic})
                </option>
              ))}
            </select>
          </div>
        )}

        {filterMode === 'student' && (
          <div className="timetable-select-filter">
            <select
              className="form-control"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">-- Select a Student --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.ic})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="timetable-week-grid">
        {DAYS_OF_WEEK.map((day) => {
          const dayLessons = lessonsByDay[day.value] || [];
          return (
            <div key={day.value} className="timetable-day-column">
              <div className="timetable-day-header">
                <span className="day-name">{day.label}</span>
                <span className="day-count">{dayLessons.length}</span>
              </div>

              <div className="timetable-day-slots">
                {dayLessons.length === 0 ? (
                  <div className="timetable-empty-slot">No lessons</div>
                ) : (
                  dayLessons.map((lesson) => (
                    <div key={lesson.id} className="timetable-card">
                      <div className="timetable-card-top">
                        <span className="time-badge">
                          <Clock size={12} /> {lesson.start_time} ({lesson.duration_minutes}m)
                        </span>
                        <span className="instrument-badge">
                          <Music size={12} /> {lesson.instrument}
                        </span>
                      </div>

                      <div className="timetable-card-title">
                        <strong>{lesson.student_name}</strong>
                      </div>

                      <div className="timetable-card-teacher">
                        <User size={12} /> {lesson.teacher_name}
                      </div>

                      <div className="timetable-card-meta">
                        <span className="grade-badge">{lesson.grade}</span>
                        <span className="fee-badge">{formatCurrency(lesson.monthly_student_fee)}/mo</span>
                      </div>

                      {Boolean(lesson.is_custom_rate) && (
                        <div className="custom-override-tag">Custom Rate Override</div>
                      )}

                      {onEditLesson && (
                        <button
                          className="timetable-edit-btn"
                          onClick={() => onEditLesson(lesson)}
                          title="Modify Lesson"
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
