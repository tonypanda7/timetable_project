import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'timetable.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

function init() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    working_hours INTEGER NOT NULL,
    first_preference TEXT,
    second_preference TEXT
  );
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    program TEXT,
    semester INTEGER NOT NULL,
    section TEXT
  );
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_name TEXT NOT NULL,
    semester INTEGER,
    course_name TEXT NOT NULL,
    credits INTEGER,
    course_type TEXT,
    is_lab TEXT,
    style TEXT
  );
  CREATE TABLE IF NOT EXISTS classrooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT,
    capacity INTEGER
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    teacher_id TEXT,
    course_id INTEGER,
    teacher_rating REAL,
    course_rating REAL
  );
  CREATE TABLE IF NOT EXISTS student_electives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    course_id INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS timetable_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    teacher_id TEXT NOT NULL,
    room_id INTEGER NOT NULL,
    slot TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS timetable_student_link (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timetable_entry_id INTEGER,
    student_id TEXT
  );
  CREATE TABLE IF NOT EXISTS cancellation_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timetable_entry_id INTEGER,
    teacher_id TEXT,
    status TEXT DEFAULT 'pending'
  );
  CREATE TABLE IF NOT EXISTS substitution_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cancelled_entry_id INTEGER,
    offered_to_teacher_id TEXT,
    status TEXT DEFAULT 'offered'
  );
  `);
}

init();

export default db;
