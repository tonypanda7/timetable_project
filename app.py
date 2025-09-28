import os
import uuid
import pandas as pd
from flask import Flask, request, jsonify, send_from_directory
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from collections import defaultdict
from flask_cors import CORS 

# --- Import custom modules ---
from models import Base, Teacher, Student, Course, Classroom, Feedback, StudentElective
from utils import load_csv_to_db
from solver import AntColonyTimetableSolver

# --- Configuration & Setup ---
DATABASE_URL = "sqlite:///timetable.db"
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER): os.makedirs(UPLOAD_FOLDER)

app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app) 
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
engine = create_engine(DATABASE_URL)
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)

# --- Global variables for temporary storage ---
GENERATED_TIMETABLE = None
CANCELLATION_REQUESTS = [] 
SUBSTITUTION_OFFERS = []

# --- HTML Page Serving ---
@app.route('/')
def serve_login(): return send_from_directory('.', 'login.html')
@app.route('/admin')
def serve_admin(): return send_from_directory('.', 'admin.html')
@app.route('/student')
def serve_student(): return send_from_directory('.', 'student.html')
@app.route('/teacher')
def serve_teacher(): return send_from_directory('.', 'teacher.html')

# --- Helper Function for CSV Uploads ---
def handle_csv_upload(filename, db_model):
    if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "No file selected"}), 400
    if file and file.filename.endswith('.csv'):
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        try:
            db_session = Session()
            db_session.query(db_model).delete()
            df = pd.read_csv(filepath)
            if not df.empty:
                records = df.to_dict(orient='records')
                db_session.bulk_insert_mappings(db_model, records)
            db_session.commit()
            return jsonify({"message": f"{db_model.__name__} data uploaded!"}), 201
        except pd.errors.EmptyDataError:
             db_session.commit()
             return jsonify({"message": f"Processed empty file for {db_model.__name__}."}), 200
        except Exception as e:
            db_session.rollback(); return jsonify({"error": f"Failed: {str(e)}"}), 500
        finally: db_session.close()
    else: return jsonify({"error": "Invalid file type"}), 400

# --- API Endpoints ---
# --- Admin Routes ---
@app.route('/api/admin/upload/teachers', methods=['POST'])
def upload_teachers_csv(): return handle_csv_upload('teachers.csv', Teacher)
@app.route('/api/admin/upload/students', methods=['POST'])
def upload_students_csv(): return handle_csv_upload('students.csv', Student)
@app.route('/api/admin/upload/courses', methods=['POST'])
def upload_courses_csv(): return handle_csv_upload('courses.csv', Course)
@app.route('/api/admin/upload/classrooms', methods=['POST'])
def upload_classrooms_csv(): return handle_csv_upload('classrooms.csv', Classroom)
@app.route('/api/admin/upload/feedback', methods=['POST'])
def upload_feedback_csv(): return handle_csv_upload('feedback.csv', Feedback)

@app.route('/api/admin/generate-timetable', methods=['POST'])
def generate_timetable():
    global GENERATED_TIMETABLE, CANCELLATION_REQUESTS, SUBSTITUTION_OFFERS
    GENERATED_TIMETABLE, CANCELLATION_REQUESTS, SUBSTITUTION_OFFERS = None, [], []
    db_session = Session()
    try:
        teachers, students, courses, classrooms, feedback = db_session.query(Teacher).all(), db_session.query(Student).all(), db_session.query(Course).all(), db_session.query(Classroom).all(), db_session.query(Feedback).all()
        elective_choices = db_session.query(StudentElective).all()
        constraints = {"working_days": 5, "periods_per_day": 8, "minimum_total_credits": 120}
        if not all((teachers, students, courses, classrooms)): return jsonify({"error": "Not enough base data."}), 400
        solver = AntColonyTimetableSolver(courses, teachers, students, classrooms, feedback, elective_choices, constraints)
        final_timetable = solver.solve()
        if final_timetable:
            GENERATED_TIMETABLE = final_timetable
            return jsonify({"message": "Semester-aware timetables generated!", "best_score": solver.best_timetable_score}), 200
        else:
            GENERATED_TIMETABLE = None
            return jsonify({"error": "Failed to generate a valid timetable."}), 500
    finally:
        db_session.close()

@app.route('/api/admin/cancellation-requests', methods=['GET'])
def get_cancellation_requests():
    return jsonify(CANCELLATION_REQUESTS)

@app.route('/api/admin/status', methods=['GET'])
def get_admin_status():
    db_ok = False
    counts = {}
    db_session = None
    try:
        db_session = Session()
        counts = {
            "teachers": db_session.query(Teacher).count(),
            "students": db_session.query(Student).count(),
            "courses": db_session.query(Course).count(),
            "classrooms": db_session.query(Classroom).count(),
            "feedback": db_session.query(Feedback).count(),
            "elective_choices": db_session.query(StudentElective).count(),
        }
        db_ok = True
    except Exception:
        db_ok = False
    finally:
        try:
            if db_session is not None:
                db_session.close()
        except Exception:
            pass
    uploads_present = {name: os.path.exists(os.path.join(UPLOAD_FOLDER, f"{name}.csv")) for name in ["teachers","students","courses","classrooms","feedback"]}
    return jsonify({
        "db_connected": db_ok,
        "counts": counts,
        "uploads": uploads_present,
        "timetable_generated": GENERATED_TIMETABLE is not None and len(GENERATED_TIMETABLE) > 0,
        "pending_requests": len(CANCELLATION_REQUESTS),
        "substitution_offers": len(SUBSTITUTION_OFFERS),
    })

@app.route('/api/admin/handle-cancellation', methods=['POST'])
def handle_cancellation():
    global GENERATED_TIMETABLE, CANCELLATION_REQUESTS, SUBSTITUTION_OFFERS
    data = request.json
    req_id, action = data.get('request_id'), data.get('action')
    if not all((req_id, action)): return jsonify({"error": "Missing data"}), 400
    original_request = next((req for req in CANCELLATION_REQUESTS if req['id'] == req_id), None)
    if not original_request: return jsonify({"error": "Request ID not found."}), 404
    CANCELLATION_REQUESTS = [req for req in CANCELLATION_REQUESTS if req['id'] != req_id]
    if action == 'approve' and GENERATED_TIMETABLE:
        cancelled_class_entry = None
        for i, entry in enumerate(GENERATED_TIMETABLE):
            if entry['teacher'].id == original_request['teacher_id'] and entry['slot'] == original_request['slot']:
                cancelled_class_entry = GENERATED_TIMETABLE.pop(i)
                break
        if cancelled_class_entry:
            db_session = Session()
            all_teachers = db_session.query(Teacher).all()
            db_session.close()
            occupied_slots = { (e['teacher'].id, e['slot']) for e in GENERATED_TIMETABLE }
            for teacher in all_teachers:
                is_free = (teacher.id, cancelled_class_entry['slot']) not in occupied_slots
                can_teach = cancelled_class_entry['course'].course_name in (teacher.first_preference, teacher.second_preference)
                if teacher.id != original_request['teacher_id'] and is_free and can_teach:
                    offer_details = {"course_id": cancelled_class_entry['course'].id, "group": cancelled_class_entry['group'], "students": cancelled_class_entry['students'], "room_id": cancelled_class_entry['room'].id, "slot": cancelled_class_entry['slot']}
                    offer = {"id": str(uuid.uuid4()), "details": offer_details, "course_name": cancelled_class_entry['course'].course_name, "group": cancelled_class_entry['group'], "students": cancelled_class_entry['students'], "slot": cancelled_class_entry['slot'], "offered_to_teacher_id": teacher.id}
                    SUBSTITUTION_OFFERS.append(offer)
    return jsonify({"message": f"Request {action}d."}), 200

# --- Student Routes ---
@app.route('/api/student/available-electives', methods=['GET'])
def get_available_electives():
    student_id = request.args.get('student_id'); program = request.args.get('program')
    if not student_id or not program: return jsonify({"error": "Student ID and Program are required."}), 400
    db_session = Session()
    try:
        elective_types = ["Minor", "Skill-Based", "Ability Enhancement", "Value-Added"]
        available = db_session.query(Course).filter(Course.program_name == program, Course.course_type.in_(elective_types)).all()
        selected_ids = {se.course_id for se in db_session.query(StudentElective).filter_by(student_id=student_id).all()}
        data = [{"id": c.id, "course_name": c.course_name, "credits": c.credits, "course_type": c.course_type, "is_selected": c.id in selected_ids} for c in available]
        return jsonify({"electives": data}), 200
    finally: db_session.close()

@app.route('/api/student/save-electives', methods=['POST'])
def save_student_electives():
    data = request.json
    student_id, course_ids = data.get('student_id'), data.get('course_ids', [])
    if not student_id: return jsonify({"error": "Student ID is required."}), 400
    db_session = Session()
    try:
        db_session.query(StudentElective).filter_by(student_id=student_id).delete()
        for course_id in course_ids:
            db_session.add(StudentElective(student_id=student_id, course_id=int(course_id)))
        db_session.commit()
        return jsonify({"message": "Your elective choices have been saved!"}), 201
    finally: db_session.close()

@app.route('/api/student/timetable', methods=['GET'])
def get_student_timetable():
    student_id = request.args.get('student_id')
    if not student_id: return jsonify({"error": "Student ID must be provided."}), 400
    if GENERATED_TIMETABLE is None: return jsonify({"error": "No timetable has been generated."}), 404
    student_schedule = []
    for entry in GENERATED_TIMETABLE:
        if student_id in entry['students']:
            day, period = entry['slot'].split('_')
            student_schedule.append({
                "day": day, "period": int(period), "course_name": entry['course'].course_name,
                "teacher_name": entry['teacher'].id, "room_name": entry['room'].location,
            })
    return jsonify({"timetable": student_schedule, "days": ["Mon", "Tue", "Wed", "Thu", "Fri"], "periods": 8})

# --- Teacher Routes ---
@app.route('/api/teacher/timetable', methods=['GET'])
def get_teacher_timetable():
    teacher_id = request.args.get('teacher_id')
    if not teacher_id: return jsonify({"error": "Teacher ID required."}), 400
    if not GENERATED_TIMETABLE: return jsonify({"error": "No timetable generated."}), 404
    teacher_schedule, total_hours = [], 0
    for entry in GENERATED_TIMETABLE:
        if entry['teacher'].id == teacher_id:
            day, period = entry['slot'].split('_')
            teacher_schedule.append({
                "day": day, "period": int(period), "course_name": entry['course'].course_name,
                "group": entry['group'],
                "students": entry['students'],
                "room_name": entry['room'].location,
            })
            total_hours += 1
    workload_left = 20 - total_hours 
    return jsonify({"timetable": teacher_schedule, "days": ["Mon", "Tue", "Wed", "Thu", "Fri"], "periods": 8, "workload": workload_left})

@app.route('/api/teacher/cancel-class', methods=['POST'])
def cancel_class():
    data = request.json
    if not data: return jsonify({"error": "Invalid request"}), 400
    data['id'] = str(uuid.uuid4())
    CANCELLATION_REQUESTS.append(data)
    return jsonify({"message": "Request received and pending approval."}), 201

@app.route('/api/teacher/substitution-offers', methods=['GET'])
def get_substitution_offers():
    teacher_id = request.args.get('teacher_id')
    if not teacher_id: return jsonify({"error": "Teacher ID required."}), 400
    offers_for_teacher = [o for o in SUBSTITUTION_OFFERS if o['offered_to_teacher_id'] == teacher_id]
    return jsonify(offers_for_teacher)

@app.route('/api/teacher/accept-substitution', methods=['POST'])
def accept_substitution():
    global GENERATED_TIMETABLE, SUBSTITUTION_OFFERS
    data = request.json
    offer_id, accepting_teacher_id = data.get('offer_id'), data.get('accepting_teacher_id')
    if not all((offer_id, accepting_teacher_id)): return jsonify({"error": "Missing data"}), 400
    offer_found = next((o for o in SUBSTITUTION_OFFERS if o['id'] == offer_id), None)
    if not offer_found: return jsonify({"error": "Offer not found or already taken."}), 404
    details = offer_found['details']
    db_session = Session()
    new_teacher = db_session.query(Teacher).filter_by(id=accepting_teacher_id).first()
    course = db_session.query(Course).filter_by(id=details['course_id']).first()
    room = db_session.query(Classroom).filter_by(id=details['room_id']).first()
    db_session.close()
    if not all((new_teacher, course, room)):
        return jsonify({"error": "Database inconsistency found."}), 500
    new_class_entry = {'course': course, 'teacher': new_teacher, 'group': details['group'], 'students': details['students'], 'room': room, 'slot': details['slot']}
    GENERATED_TIMETABLE.append(new_class_entry)
    SUBSTITUTION_OFFERS = [o for o in SUBSTITUTION_OFFERS if o['details'] != offer_found['details']]
    return jsonify({"message": "Substitution successful! Your timetable has been updated."}), 200

if __name__ == '__main__':
    app.run(debug=True)
