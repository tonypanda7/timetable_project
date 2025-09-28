"use client";
import { useEffect, useState } from 'react';

export default function StudentPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted) init(); }, [mounted]);

  function logout() {
    try { sessionStorage.removeItem('loggedInUserId'); } catch (_) {}
    window.location.href = '/';
  }

  async function init() {
    const STUDENT_ID = sessionStorage.getItem('loggedInUserId');
    if (!STUDENT_ID) {
      document.body.innerHTML = '<div class="text-center p-8 text-red-600">Error: Not logged in. Please <a href="/" class="text-blue-600 underline">login</a> first.</div>';
      return;
    }
    const el = document.getElementById('student-id-display');
    if (el) el.textContent = STUDENT_ID;
    await fetchAndRenderTimetable(STUDENT_ID);
    await fetchAndRenderElectives(STUDENT_ID);
    document.getElementById('save-electives-btn')?.addEventListener('click', () => saveElectives(STUDENT_ID));
  }

  async function fetchAndRenderTimetable(STUDENT_ID) {
    const grid = document.getElementById('timetable-grid');
    const loading = document.getElementById('timetable-loading');
    try {
      const response = await fetch(`/api/student/timetable?student_id=${encodeURIComponent(STUDENT_ID)}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch timetable.');
      }
      const data = await response.json();
      if (data.timetable.length === 0) throw new Error('Your personalized timetable has not been generated or is empty.');
      loading?.classList.add('hidden'); grid?.classList.remove('hidden');
      createGridHeaders(grid, data.days, data.periods);
      const courseColors = {}; const colorClasses = ['bg-blue-100 text-blue-800','bg-green-100 text-green-800','bg-yellow-100 text-yellow-800','bg-purple-100 text-purple-800','bg-pink-100 text-pink-800']; let colorIndex = 0;
      data.timetable.forEach(item => {
        if (!courseColors[item.course_name]) { courseColors[item.course_name] = colorClasses[colorIndex % colorClasses.length]; colorIndex++; }
        const cell = document.createElement('div');
        cell.style.gridColumn = data.days.indexOf(item.day) + 2; cell.style.gridRow = item.period + 1;
        cell.className = `class-cell ${courseColors[item.course_name]} flex flex-col justify-between`;
        cell.innerHTML = `<div><p class=\"font-bold text-sm\">${item.course_name}</p><p class=\"text-xs opacity-80\">Prof. ${item.teacher_name}</p></div><p class=\"text-xs font-semibold self-end\">${item.room_name}</p>`;
        grid.appendChild(cell);
      });
    } catch (error) { if (loading) loading.textContent = `❌ Error: ${error.message}`; }
  }

  function createGridHeaders(grid, days, periods) {
    if (!grid) return;
    grid.innerHTML = '<div></div>';
    days.forEach(day => { const c = document.createElement('div'); c.className = 'grid-header flex items-center justify-center'; c.textContent = day; grid.appendChild(c); });
    for (let i = 1; i <= periods; i++) {
      const t = document.createElement('div'); t.className = 'time-slot flex items-center justify-center'; t.textContent = `${7 + i}:00`; grid.appendChild(t);
      for (let j = 0; j < days.length; j++) { const e = document.createElement('div'); e.style.gridColumn = j + 2; e.style.gridRow = i + 1; e.className = 'bg-gray-50 rounded-lg'; grid.appendChild(e); }
    }
  }

  async function fetchAndRenderElectives(STUDENT_ID) {
    const container = document.getElementById('electives-container');
    const loading = document.getElementById('electives-loading');
    try {
      const studentProgram = 'CS';
      const response = await fetch(`/api/student/available-electives?student_id=${encodeURIComponent(STUDENT_ID)}&program=${encodeURIComponent(studentProgram)}`);
      if (!response.ok) throw new Error('Could not fetch electives');
      const data = await response.json();
      loading?.classList.add('hidden'); if (container) container.innerHTML = '';
      if (data.electives.length === 0) { if (container) container.innerHTML = '<p class="text-gray-500">No elective courses are available for your program.</p>'; document.getElementById('save-electives-btn')?.setAttribute('disabled','true'); return; }
      const electivesHtml = data.electives.map(course => `
        <div>
          <input type="checkbox" id="course-${course.id}" value="${course.id}" class="elective-checkbox hidden" name="electives" ${course.is_selected ? 'checked' : ''}>
          <label for="course-${course.id}" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500">
            <div class="flex justify-between">
              <span class="font-semibold text-gray-800">${course.course_name}</span>
              <span class="text-sm text-gray-500">${course.credits} Credits</span>
            </div>
            <p class="text-sm text-gray-600 mt-1">${course.course_type}</p>
          </label>
        </div>`).join('');
      if (container) container.innerHTML = electivesHtml;
    } catch (error) { if (loading) { loading.textContent = `Error: ${error.message}`; loading.classList.add('text-red-600'); } }
  }

  async function saveElectives(STUDENT_ID) {
    const selectedCourses = Array.from(document.querySelectorAll('input[name="electives"]:checked')).map(cb => cb.value);
    const statusDiv = document.getElementById('save-status'); const saveBtn = document.getElementById('save-electives-btn');
    if (statusDiv) statusDiv.textContent = 'Saving...'; if (saveBtn) saveBtn.setAttribute('disabled','true');
    try {
      const response = await fetch('/api/student/save-electives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: STUDENT_ID, course_ids: selectedCourses }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save');
      if (statusDiv) { statusDiv.textContent = `✅ ${result.message}`; statusDiv.classList.remove('text-red-600'); statusDiv.classList.add('text-green-600'); }
    } catch (error) {
      if (statusDiv) { statusDiv.textContent = `❌ Error: ${error.message}`; statusDiv.classList.remove('text-green-600'); statusDiv.classList.add('text-red-600'); }
    } finally { saveBtn?.removeAttribute('disabled'); }
  }

  if (!mounted) return null;
  return (
    <main className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Student Dashboard</h1>
          <p className="text-gray-500 mt-1">Logged in as: <span id="student-id-display" className="font-semibold text-gray-700"></span></p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <button className="bg-white text-gray-700 font-semibold py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Download PDF</button>
          <button className="bg-white text-gray-700 font-semibold py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Download Excel</button>
          <button onClick={logout} className="bg-white text-gray-700 font-semibold py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Logout</button>
        </div>
      </header>
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-4">Elective Course Selection</h2>
        <div id="electives-container" className="space-y-4">
          <p id="electives-loading" className="text-gray-500">Loading available electives...</p>
        </div>
        <div className="mt-6 flex justify-end">
          <button id="save-electives-btn" className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-all duration-200">Save Selections</button>
        </div>
        <div id="save-status" className="mt-3 text-right text-sm"></div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-4">My Weekly Timetable</h2>
        <div id="timetable-grid" className="timetable-grid hidden" style={{display:'grid', gridTemplateColumns:'60px repeat(5, 1fr)', gridTemplateRows:'40px repeat(8, 1fr)', gap:'4px'}}></div>
        <div id="timetable-loading" className="text-center py-20 text-gray-500">Select electives and wait for admin to generate the timetable.</div>
      </div>
      <style>{`.class-cell{border-radius:.5rem;padding:8px;min-height:80px} .elective-checkbox:checked + label{border-color:#4f46e5;background-color:#eef2ff}`}</style>
    </main>
  );
}
