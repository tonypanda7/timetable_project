import { randomInt } from 'crypto';

const NUM_ANTS = 20;
const NUM_ITERATIONS = 150;
const PHEROMONE_EVAPORATION_RATE = 0.1;
const PHEROMONE_DEPOSIT_STRENGTH = 1.0;
const HARD_PENALTY = 1000;

export class AntColonyTimetableSolver {
  constructor(courses, teachers, students, classrooms, feedback, electiveChoices, constraints) {
    this.courses = courses;
    this.teachers = teachers;
    this.students = students;
    this.classrooms = classrooms;
    this.feedback = feedback;
    this.electiveChoices = electiveChoices;
    this.constraints = constraints;

    this.timeSlots = this._generateTimeSlots();
    this.coursePeriodsMap = this._calculateRequiredPeriods();
    this.studentGroups = this._groupStudentsBySemester();
    this.courseEnrollmentMap = this._buildCourseEnrollmentMap();
    this.schedulingBlocks = this._createSchedulingBlocks();

    this.pheromoneTrails = new Map();
    this.bestTimetable = null;
    this.bestTimetableScore = Infinity;
  }

  _groupStudentsBySemester() {
    const groups = new Map();
    for (const s of this.students) {
      const key = `${s.program}_${s.semester}_${s.section}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s.id);
    }
    return groups;
  }

  _buildCourseEnrollmentMap() {
    const map = new Map();
    for (const choice of this.electiveChoices) {
      if (!map.has(choice.course_id)) map.set(choice.course_id, []);
      map.get(choice.course_id).push(choice.student_id);
    }
    const core = this.courses.filter(c => c.course_type === 'Major');
    for (const [groupName, studentIds] of this.studentGroups.entries()) {
      const [program, semesterStr] = groupName.split('_');
      const semester = parseInt(semesterStr, 10);
      for (const course of core) {
        if (course.program_name === program && course.semester === semester) {
          if (!map.has(course.id)) map.set(course.id, []);
          map.get(course.id).push(...studentIds);
        }
      }
    }
    return map;
  }

  _createSchedulingBlocks() {
    const blocks = [];
    const coreCourses = this.courses.filter(c => c.course_type === 'Major');
    const electiveCourses = this.courses.filter(c => c.course_type !== 'Major');
    for (const [groupName, studentIds] of this.studentGroups.entries()) {
      const [program, semesterStr] = groupName.split('_');
      const semester = parseInt(semesterStr, 10);
      for (const course of coreCourses) {
        if (course.program_name === program && course.semester === semester) {
          const count = this.coursePeriodsMap.get(course.id) || 0;
          for (let i = 0; i < count; i++) blocks.push({ type: 'Core', group: groupName, course_id: course.id });
        }
      }
      let maxElectivePeriods = 0;
      for (const sId of studentIds) {
        let p = 0;
        for (const course of electiveCourses) {
          const enrolled = (this.courseEnrollmentMap.get(course.id) || []).includes(sId);
          if (enrolled) p += this.coursePeriodsMap.get(course.id) || 0;
        }
        if (p > maxElectivePeriods) maxElectivePeriods = p;
      }
      for (let i = 0; i < maxElectivePeriods; i++) blocks.push({ type: 'Elective', group: groupName });
    }
    for (let i = blocks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; }
    return blocks;
  }

  solve() {
    for (let i = 0; i < NUM_ITERATIONS; i++) {
      const all = Array.from({ length: NUM_ANTS }, () => this._constructSolutionForAnt());
      if (all.every(tt => tt.length === 0)) continue;
      this._updatePheromones(all);
    }
    return this.bestTimetable;
  }

  _constructSolutionForAnt() {
    const timetable = [];
    const occupied = new Map(); // key: ('group'| 'teacher'| 'room', slot) -> Set
    const occGet = (k) => { const s = occupied.get(k); if (!s) { const ns = new Set(); occupied.set(k, ns); return ns; } return s; };
    const groupLevelSchedule = new Map();

    const electiveCourses = this.courses.filter(c => c.course_type !== 'Major');
    const unscheduledElectives = new Map();
    for (const groupName of this.studentGroups.keys()) {
      unscheduledElectives.set(groupName, []);
      for (const course of electiveCourses) {
        const enrolled = (this.courseEnrollmentMap.get(course.id) || []);
        const anyInGroup = (this.studentGroups.get(groupName) || []).some(s => enrolled.includes(s));
        if (anyInGroup) {
          const count = this.coursePeriodsMap.get(course.id) || 0;
          for (let i = 0; i < count; i++) unscheduledElectives.get(groupName).push(course);
        }
      }
    }

    for (const block of this.schedulingBlocks) {
      const group = block.group;
      const availableSlots = this.timeSlots.filter(s => !occGet(`group:${s}`).has(group));
      if (availableSlots.length === 0) continue;
      const chosen = availableSlots[Math.floor(Math.random() * availableSlots.length)];
      occGet(`group:${chosen}`).add(group);
      groupLevelSchedule.set(`${chosen}|${group}`, block);
    }

    for (const [key, block] of groupLevelSchedule.entries()) {
      const [slot, group] = key.split('|');
      if (block.type === 'Core') {
        const course = this.courses.find(c => c.id === block.course_id);
        if (!course) continue;
        const teacher = this._findTeacherForCourse(course, occGet, slot);
        const room = this._findRoom(occGet, slot, (this.studentGroups.get(group) || []).length);
        if (teacher && room) {
          timetable.push({ course, teacher, group, students: this.studentGroups.get(group) || [], room, slot });
          occGet(`teacher:${slot}`).add(teacher.id);
          occGet(`room:${slot}`).add(room.id);
        }
      } else if (block.type === 'Elective') {
        const pool = [...(unscheduledElectives.get(group) || [])];
        for (const electiveCourse of pool) {
          const studentsIn = (this.studentGroups.get(group) || []).filter(s => (this.courseEnrollmentMap.get(electiveCourse.id) || []).includes(s));
          if (studentsIn.length === 0) continue;
          const teacher = this._findTeacherForCourse(electiveCourse, occGet, slot);
          const room = this._findRoom(occGet, slot, studentsIn.length);
          if (teacher && room) {
            timetable.push({ course: electiveCourse, teacher, group, students: studentsIn, room, slot });
            occGet(`teacher:${slot}`).add(teacher.id);
            occGet(`room:${slot}`).add(room.id);
            const idx = unscheduledElectives.get(group).indexOf(electiveCourse);
            if (idx >= 0) unscheduledElectives.get(group).splice(idx, 1);
          }
        }
      }
    }
    return timetable;
  }

  _calculateRequiredPeriods() {
    const map = new Map();
    const total = this.timeSlots.length;
    const minCredits = this.constraints.minimum_total_credits || 120;
    for (const course of this.courses) {
      const ratio = (course.credits || 0) / (minCredits || 120);
      const required = Math.ceil(ratio * total);
      map.set(course.id, required);
    }
    return map;
  }

  _evaluateTimetable(tt) { if (!tt || tt.length === 0) return Infinity; return this._checkClashes(tt) * HARD_PENALTY; }

  _checkClashes(tt) {
    let violations = 0;
    const teacherSlots = new Set();
    const roomSlots = new Set();
    const studentSlots = new Set();
    for (const entry of tt) {
      const slot = entry.slot;
      const tKey = `${entry.teacher.id}|${slot}`;
      if (teacherSlots.has(tKey)) violations++; teacherSlots.add(tKey);
      const rKey = `${entry.room.id}|${slot}`;
      if (roomSlots.has(rKey)) violations++; roomSlots.add(rKey);
      for (const sid of entry.students) {
        const sKey = `${sid}|${slot}`;
        if (studentSlots.has(sKey)) violations++; studentSlots.add(sKey);
      }
    }
    return violations;
  }

  _findTeacherForCourse(course, occGet, slot) {
    const suitable = this.teachers.filter(t => [t.first_preference, t.second_preference].includes(course.course_name));
    for (const teacher of suitable) { if (!occGet(`teacher:${slot}`).has(teacher.id)) return teacher; }
    return null;
  }

  _findRoom(occGet, slot, numStudents) {
    for (const room of this.classrooms) { if (!occGet(`room:${slot}`).has(room.id) && (room.capacity || 0) >= numStudents) return room; }
    return null;
  }

  _generateTimeSlots() {
    const slots = []; const days = ['Mon','Tue','Wed','Thu','Fri'];
    const perDay = this.constraints.periods_per_day || 8;
    for (const day of days) { for (let p = 1; p <= perDay; p++) slots.push(`${day}_${p}`); }
    return slots;
  }

  _updatePheromones(all) {
    for (const tt of all) {
      if (!tt || tt.length === 0) continue;
      const score = this._evaluateTimetable(tt);
      if (score < this.bestTimetableScore) { this.bestTimetableScore = score; this.bestTimetable = tt; }
    }
    if (this.bestTimetable) {
      for (const [k,v] of this.pheromoneTrails.entries()) this.pheromoneTrails.set(k, v * (1 - PHEROMONE_EVAPORATION_RATE));
      const deposit = PHEROMONE_DEPOSIT_STRENGTH / (this.bestTimetableScore + 1e-5);
      for (const entry of this.bestTimetable) {
        const key = `${entry.course.id}|${entry.slot}`;
        this.pheromoneTrails.set(key, (this.pheromoneTrails.get(key) || 1) + deposit);
      }
    }
  }
}
