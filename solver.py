import random
from collections import defaultdict
import math

# --- Constants ---
NUM_ANTS = 20
NUM_ITERATIONS = 150 
PHEROMONE_EVAPORATION_RATE = 0.1
PHEROMONE_DEPOSIT_STRENGTH = 1.0
HEURISTIC_WEIGHT = 2.5
HARD_PENALTY = 1000

class AntColonyTimetableSolver:
    """
    Definitive version of the solver. Upgraded to handle semester-specific
    student groups to ensure correct timetables for different years.
    """
    def __init__(self, courses, teachers, students, classrooms, feedback, elective_choices, constraints):
        self.courses = courses
        self.teachers = teachers
        self.students = students
        self.classrooms = classrooms
        self.feedback = feedback
        self.elective_choices = elective_choices
        self.constraints = constraints

        self.time_slots = self._generate_time_slots()
        self.course_periods_map = self._calculate_required_periods()
        
        # --- UPGRADE: Student grouping is now semester-aware ---
        self.student_groups = self._group_students_by_semester()
        self.course_enrollment_map = self._build_course_enrollment_map()
        self.scheduling_blocks = self._create_scheduling_blocks()

        self.pheromone_trails = self._initialize_pheromones()
        self.best_timetable = None
        self.best_timetable_score = float('inf')

    def _group_students_by_semester(self):
        """Groups students by program, SEMESTER, and section."""
        groups = defaultdict(list)
        for s in self.students:
            # The group key now includes the semester for uniqueness
            groups[f"{s.program}_{s.semester}_{s.section}"].append(s.id)
        print(f"Created student groups: {list(groups.keys())}")
        return dict(groups)

    def _build_course_enrollment_map(self):
        """Maps courses to students, considering program and semester for core courses."""
        enrollment_map = defaultdict(list)
        # 1. Enroll students in their chosen electives
        for choice in self.elective_choices:
            enrollment_map[choice.course_id].append(choice.student_id)
        
        # 2. UPGRADE: Enroll students in core courses matching their program AND semester
        core_courses = [c for c in self.courses if c.course_type == 'Major']
        
        for group_name, student_ids in self.student_groups.items():
            program, semester_str, _section = group_name.split('_')
            semester = int(semester_str)
            
            for course in core_courses:
                if course.program_name == program and course.semester == semester:
                    # Enroll all students of this group into this core course
                    enrollment_map[course.id].extend(student_ids)
        return enrollment_map

    def _create_scheduling_blocks(self):
        """Creates abstract blocks to be placed on the timetable, respecting semesters."""
        blocks = []
        core_courses = [c for c in self.courses if c.course_type == 'Major']
        elective_courses = [c for c in self.courses if c.course_type != 'Major']
        
        for group_name, student_ids in self.student_groups.items():
            program, semester_str, _section = group_name.split('_')
            semester = int(semester_str)
            
            # Create blocks for core courses for this specific semester
            for course in core_courses:
                if course.program_name == program and course.semester == semester:
                    for _ in range(self.course_periods_map.get(course.id, 0)):
                        blocks.append({'type': 'Core', 'group': group_name, 'course_id': course.id})
            
            # Create blocks for shared elective slots for this group
            max_elective_periods = 0
            for s_id in student_ids:
                student_elective_periods = 0
                for course in elective_courses:
                    if s_id in self.course_enrollment_map.get(course.id, []):
                        student_elective_periods += self.course_periods_map.get(course.id, 0)
                if student_elective_periods > max_elective_periods:
                    max_elective_periods = student_elective_periods
            
            for _ in range(max_elective_periods):
                blocks.append({'type': 'Elective', 'group': group_name})
        return blocks
    
    def solve(self):
        for i in range(NUM_ITERATIONS):
            all_ant_timetables = [self._construct_solution_for_ant() for _ in range(NUM_ANTS)]
            if not any(all_ant_timetables): continue
            self._update_pheromones(all_ant_timetables)
            print(f"Iteration {i+1}/{NUM_ITERATIONS} | Best Score: {self.best_timetable_score}")
        return self.best_timetable

    def _construct_solution_for_ant(self):
        timetable = []
        occupied_slots = defaultdict(set)
        group_level_schedule = {}
        
        unscheduled_electives = defaultdict(list)
        elective_courses = [c for c in self.courses if c.course_type != 'Major']
        for group_name in self.student_groups:
            for course in elective_courses:
                if any(s in self.student_groups[group_name] for s in self.course_enrollment_map.get(course.id, [])):
                    for _ in range(self.course_periods_map.get(course.id, 0)):
                        unscheduled_electives[group_name].append(course)

        random.shuffle(self.scheduling_blocks)
        for block in self.scheduling_blocks:
            group = block['group']
            available_slots = [s for s in self.time_slots if group not in occupied_slots[('group', s)]]
            if not available_slots: continue
            chosen_slot = random.choice(available_slots)
            occupied_slots[('group', chosen_slot)].add(group)
            group_level_schedule[(chosen_slot, group)] = block

        for (slot, group), block in group_level_schedule.items():
            if block['type'] == 'Core':
                course = next((c for c in self.courses if c.id == block['course_id']), None)
                if not course: continue
                teacher = self._find_teacher_for_course(course, occupied_slots, slot)
                room = self._find_room(occupied_slots, slot, len(self.student_groups[group]))
                if teacher and room:
                    timetable.append({'course': course, 'teacher': teacher, 'group': group, 'students': self.student_groups[group], 'room': room, 'slot': slot})
                    occupied_slots[('teacher', slot)].add(teacher.id)
                    occupied_slots[('room', slot)].add(room.id)
            elif block['type'] == 'Elective':
                electives_to_schedule_now = list(unscheduled_electives[group])
                for elective_course in electives_to_schedule_now:
                    students_in_elective = [s for s in self.student_groups[group] if s in self.course_enrollment_map[elective_course.id]]
                    if not students_in_elective: continue
                    teacher = self._find_teacher_for_course(elective_course, occupied_slots, slot)
                    room = self._find_room(occupied_slots, slot, len(students_in_elective))
                    if teacher and room:
                        timetable.append({'course': elective_course, 'teacher': teacher, 'group': group, 'students': students_in_elective, 'room': room, 'slot': slot})
                        occupied_slots[('teacher', slot)].add(teacher.id)
                        occupied_slots[('room', slot)].add(room.id)
                        unscheduled_electives[group].remove(elective_course)
        return timetable

    def _calculate_required_periods(self):
        course_periods_map = {}
        total_periods = len(self.time_slots)
        min_credits = self.constraints.get('minimum_total_credits', 120)
        if min_credits == 0: min_credits = 120
        for course in self.courses:
            ratio = course.credits / min_credits
            required = math.ceil(ratio * total_periods)
            course_periods_map[course.id] = required
        return course_periods_map
        
    def _evaluate_timetable(self, timetable):
        if not timetable: return float('inf')
        return self._check_clashes(timetable) * HARD_PENALTY
        
    def _check_clashes(self, timetable):
        violations = 0
        teacher_slots, room_slots, student_slots = set(), set(), set()
        for entry in timetable:
            slot = entry['slot']
            if (entry['teacher'].id, slot) in teacher_slots: violations +=1
            teacher_slots.add((entry['teacher'].id, slot))
            if (entry['room'].id, slot) in room_slots: violations += 1
            room_slots.add((entry['room'].id, slot))
            for student_id in entry['students']:
                if (student_id, slot) in student_slots: violations += 1
                student_slots.add((student_id, slot))
        return violations
        
    def _find_teacher_for_course(self, course, occupied_slots, slot):
        suitable_teachers = [t for t in self.teachers if course.course_name in (t.first_preference, t.second_preference)]
        for teacher in suitable_teachers:
            if teacher.id not in occupied_slots[('teacher', slot)]: return teacher
        return None

    def _find_room(self, occupied_slots, slot, num_students):
        for room in self.classrooms:
            if room.id not in occupied_slots[('room', slot)] and room.capacity >= num_students:
                return room
        return None
        
    def _generate_time_slots(self):
        slots = []; days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        for day in days:
            for period in range(1, self.constraints.get('periods_per_day', 8) + 1): slots.append(f"{day}_{period}")
        return slots
        
    def _initialize_pheromones(self): return defaultdict(lambda: 1.0)
    
    def _update_pheromones(self, all_ant_timetables):
        for tt in all_ant_timetables:
            if not tt: continue
            score = self._evaluate_timetable(tt)
            if score < self.best_timetable_score: self.best_timetable_score, self.best_timetable = score, tt
        if self.best_timetable:
             for key in self.pheromone_trails: self.pheromone_trails[key] *= (1 - PHEROMONE_EVAPORATION_RATE)
             deposit = PHEROMONE_DEPOSIT_STRENGTH / (self.best_timetable_score + 1e-5)
             for entry in self.best_timetable: self.pheromone_trails[(entry['course'].id, entry['slot'])] += deposit

