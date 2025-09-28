"use client";
import { useEffect, useState } from 'react';

export default function TeacherPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted) fetchAndRenderData(); }, [mounted]);
  const TEACHER_ID = typeof window !== 'undefined' ? sessionStorage.getItem('loggedInUserId') : null;

  function logout() {
    try { sessionStorage.removeItem('loggedInUserId'); } catch (_) {}
    window.location.href = '/';
  }

  async function fetchAndRenderData() {
    if (!TEACHER_ID) {
      document.body.innerHTML = '<div class="text-center p-8 text-red-600">Error: Not logged in. Please <a href="/" class="text-blue-600 underline">login</a> first.</div>';
      return;
    }
    const disp = document.getElementById('teacher-id-display'); if (disp) disp.textContent = TEACHER_ID;
    await fetchTimetable(); await fetchSubstitutions();
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

  async function fetchTimetable() {
    const grid = document.getElementById('timetable-grid');
    const loading = document.getElementById('timetable-loading');
    try {
      const response = await fetch(`/api/teacher/timetable?teacher_id=${encodeURIComponent(TEACHER_ID)}`);
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Failed to fetch timetable'); }
      const data = await response.json();
      loading?.classList.add('hidden'); grid?.classList.remove('hidden'); grid.innerHTML = '';
      const workload = document.getElementById('workload-display'); if (workload) workload.textContent = data.workload;
      createGridHeaders(grid, data.days, data.periods);
      data.timetable.forEach(item => {
        const cell = document.createElement('div');
        cell.style.gridColumn = data.days.indexOf(item.day) + 2;
        cell.style.gridRow = item.period + 1;
        cell.className = 'class-cell bg-indigo-100 text-indigo-800 flex flex-col justify-between';
        const studentInfo = `${item.students.length} Student(s) in ${item.group}`;
        cell.innerHTML = `<div><p class=\"font-bold text-sm\">${item.course_name}</p><p class=\"text-xs opacity-80\">${studentInfo}</p></div><p class=\"text-xs font-semibold self-end\">${item.room_name}</p>`;
        cell.onclick = () => openCancellationModal(item);
        grid.appendChild(cell);
      });
    } catch (error) { if (loading) loading.textContent = `❌ Error: ${error.message}`; }
  }

  async function fetchSubstitutions() {
    const list = document.getElementById('substitutions-list');
    try {
      const response = await fetch(`/api/teacher/substitution-offers?teacher_id=${encodeURIComponent(TEACHER_ID)}`);
      if (!response.ok) throw new Error('Server error');
      const offers = await response.json();
      if (offers.length === 0) { if (list) list.innerHTML = `<p class=\"text-sm text-gray-500 text-center p-4\">No substitution opportunities available.</p>`; return; }
      if (list) list.innerHTML = '';
      offers.forEach(offer => {
        const item = document.createElement('div');
        item.className = 'p-3 bg-green-50 rounded-lg border border-green-200';
        item.innerHTML = `
          <p class=\"font-semibold text-gray-800 text-sm\">${offer.course_name}</p>
          <p class=\"text-xs text-gray-500\">For group ${offer.group} | Slot: ${offer.slot}</p>
          <div class=\"mt-2 flex justify-end\">
            <button class=\"px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700\">Accept Class</button>
          </div>`;
        item.querySelector('button').onclick = () => handleSubstitution(offer.id);
        list?.appendChild(item);
      });
    } catch (error) { if (list) list.innerHTML = `<p class=\"text-sm text-red-500 text-center p-4\">Could not fetch substitution offers.</p>`; }
  }

  async function handleSubstitution(offerId) {
    try {
      const response = await fetch('/api/teacher/accept-substitution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer_id: offerId, accepting_teacher_id: TEACHER_ID }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to accept');
      alert(result.message);
      fetchAndRenderData();
    } catch (error) { alert(`Error: ${error.message}`); }
  }

  function openCancellationModal(classDetails) {
    activeCancellationRequest = { teacher_id: TEACHER_ID, slot: `${classDetails.day}_${classDetails.period}`, course_name: classDetails.course_name, group: classDetails.group, students: classDetails.students };
    const details = document.getElementById('modal-class-details'); if (details) details.textContent = `Class: ${classDetails.course_name} at ${classDetails.day}, Period ${classDetails.period}`;
    document.getElementById('cancellation-modal')?.classList.remove('hidden');
  }

  function closeModal() { document.getElementById('cancellation-modal')?.classList.add('hidden'); }

  let activeCancellationRequest = null;

  if (!mounted) return null;
  return (
    <main className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">My Weekly Timetable</h1>
          <p className="text-gray-500 mt-1">Logged in as: <span id="teacher-id-display" className="font-semibold text-gray-700"></span></p>
        </div>
        <div className="flex flex-col items-end gap-2 mt-4 sm:mt-0">
          <div className="bg-white p-3 rounded-lg shadow-sm text-center">
            <p className="text-sm text-gray-500">Weekly Hours Left</p>
            <p id="workload-display" className="text-2xl font-bold text-blue-600">--</p>
          </div>
          <button onClick={logout} className="bg-white text-gray-700 font-semibold py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Logout</button>
        </div>
      </header>
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <div id="timetable-grid" className="timetable-grid hidden" style={{display:'grid', gridTemplateColumns:'60px repeat(5, 1fr)', gridTemplateRows:'40px repeat(8, 1fr)', gap:'4px'}}></div>
        <div id="timetable-loading" className="text-center py-20 text-gray-500">Loading timetable...</div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Substitution Opportunities</h2>
          <button id="refresh-subs-btn" className="text-sm text-blue-600 hover:underline" onClick={() => fetchSubstitutions()}>Refresh</button>
        </div>
        <div id="substitutions-list" className="space-y-3 max-h-72 overflow-y-auto">
          <p className="text-sm text-gray-500 text-center p-4">No substitution opportunities available.</p>
        </div>
      </div>
      <div id="cancellation-modal" className="fixed inset-0 z-50 flex items-center justify-center hidden" style={{backgroundColor:'rgba(0,0,0,0.5)'}}>
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4">
          <h2 className="text-xl font-bold text-gray-800">Request Class Cancellation</h2>
          <p id="modal-class-details" className="text-gray-600 my-2"></p>
          <p className="text-sm text-gray-500 mt-4">Are you sure? A notification will be sent to the admin for approval.</p>
          <div className="mt-6 flex justify-end space-x-3">
            <button id="modal-cancel-btn" className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300" onClick={closeModal}>Back</button>
            <button id="modal-confirm-btn" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700" onClick={async () => {
              if (!activeCancellationRequest) return;
              try {
                const response = await fetch('/api/teacher/cancel-class', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activeCancellationRequest) });
                const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Failed to send request'); alert(result.message); closeModal();
              } catch (error) { alert(`Error: ${error.message}`); }
            }}>Confirm Cancellation</button>
          </div>
        </div>
      </div>
      <style>{`.class-cell{border-radius:.5rem;padding:8px;min-height:80px;transition:all .2s;cursor:pointer}.class-cell:hover{transform:scale(1.05);z-index:10;box-shadow:0 10px 15px -3px rgb(0 0 0 / 0.1),0 4px 6px -4px rgb(0 0 0 / 0.1)}`}</style>
    </main>
  );
}
