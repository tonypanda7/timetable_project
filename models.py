from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

# --- Existing Tables ---
class Teacher(Base):
    __tablename__ = 'teachers'
    id = Column(String, primary_key=True)
    # ... (rest of Teacher model is unchanged) ...
    working_hours = Column(Integer, nullable=False)
    first_preference = Column(String)
    second_preference = Column(String)


class Student(Base):
    __tablename__ = 'students'
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    program = Column(String)
    # --- NEW FIELD ---
    semester = Column(Integer, nullable=False)
    section = Column(String)

class Course(Base):
    __tablename__ = 'courses'
    id = Column(Integer, primary_key=True, autoincrement=True)
    program_name = Column(String, nullable=False)
    semester = Column(Integer)
    course_name = Column(String, nullable=False)
    credits = Column(Integer)
    course_type = Column(String) 
    is_lab = Column(String)
    style = Column(String)

# ... (rest of models.py is unchanged) ...
class Classroom(Base):
    __tablename__ = 'classrooms'
    id = Column(Integer, primary_key=True, autoincrement=True)
    location = Column(String)
    capacity = Column(Integer)

class Feedback(Base):
    __tablename__ = 'feedback'
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, ForeignKey('students.id'))
    teacher_id = Column(String, ForeignKey('teachers.id'))
    course_id = Column(Integer, ForeignKey('courses.id'))
    teacher_rating = Column(Float)
    course_rating = Column(Float)

class StudentElective(Base):
    __tablename__ = 'student_electives'
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, ForeignKey('students.id'), nullable=False)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)

class TimetableEntry(Base):
    __tablename__ = 'timetable_entries'
    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)
    teacher_id = Column(String, ForeignKey('teachers.id'), nullable=False)
    room_id = Column(Integer, ForeignKey('classrooms.id'), nullable=False)
    slot = Column(String, nullable=False)

class TimetableStudentLink(Base):
    __tablename__ = 'timetable_student_link'
    id = Column(Integer, primary_key=True, autoincrement=True)
    timetable_entry_id = Column(Integer, ForeignKey('timetable_entries.id'))
    student_id = Column(String, ForeignKey('students.id'))

class CancellationRequest(Base):
    __tablename__ = 'cancellation_requests'
    id = Column(Integer, primary_key=True, autoincrement=True)
    timetable_entry_id = Column(Integer, ForeignKey('timetable_entries.id'), nullable=False)
    teacher_id = Column(String, ForeignKey('teachers.id'), nullable=False)
    status = Column(String, default='pending')

class SubstitutionOffer(Base):
    __tablename__ = 'substitution_offers'
    id = Column(Integer, primary_key=True, autoincrement=True)
    cancelled_entry_id = Column(Integer, nullable=False)
    offered_to_teacher_id = Column(String, ForeignKey('teachers.id'), nullable=False)
    status = Column(String, default='offered')

