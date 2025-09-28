"use client";
import { useEffect, useState } from 'react';

const datasets = [
  { id: 'teachers', name: 'Teachers', endpoint: '/api/admin/upload/teachers' },
  { id: 'students', name: 'Students', endpoint: '/api/admin/upload/students' },
  { id: 'courses', name: 'Courses', endpoint: '/api/admin/upload/courses' },
  { id: 'classrooms', name: 'Classrooms', endpoint: '/api/admin/upload/classrooms' },
  { id: 'feedback', name: 'Feedback', endpoint: '/api/admin/upload/feedback' }
];

export default function AdminPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    createUploadForms();
    datasets.forEach(d => {
      const el = document.getElementById(`${d.id}-file`);
      if (el) el.addEventListener('change', () => handleFileUpload(d));
    });
    fetchAndDisplayRequests();
    createStatusIndicators();
  }, [mounted]);

  async function createStatusIndicators() {
    const container = document.getElementById('status-container');
    if (!container) return;
    container.innerHTML = '<p class="text-gray-500">Loading status...</p>';
    try {
      const res = await fetch('/api/admin/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      const s = await res.json();
      const item = (label, ok, extra='') => `
        <div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg border">
          <div class="flex items-center space-x-2">
            <span class="status-dot ${ok ? 'dot-green' : 'dot-red'}"></span>
            <span class="text-sm text-gray-700">${label}</span>
          </div>
          ${extra}
        </div>`;
      const uploads = ['teachers','students','courses','classrooms','feedback']
        .map(k => item(`${k.charAt(0).toUpperCase()+k.slice(1)} CSV`, s.uploads[k]));
      const dbCounts = Object.entries(s.counts)
        .map(([k,v]) => `<span class=\"text-xs text-gray-500\">${k}: ${v}</span>`)
        .join(' · ');
      container.innerHTML = [
        item('Database connection', s.db_connected, `<span class=\"text-xs text-gray-500\">${dbCounts}</span>`),
        item('Timetable generated', s.timetable_generated),
        item('Pending cancellation requests', s.pending_requests > 0, `<span class=\"text-xs text-gray-500\">${s.pending_requests}</span>`),
        item('Open substitution offers', s.substitution_offers > 0, `<span class=\"text-xs text-gray-500\">${s.substitution_offers}</span>`),
        ...uploads
      ].join('');
    } catch (e) {
      container.innerHTML = '<p class="text-red-600 text-sm">Failed to load status.</p>';
    }
  }

  function createUploadForms() {
    const grid = document.getElementById('upload-grid');
    if (!grid) return;
    datasets.forEach(d => {
      const formHtml = `
        <div class="space-y-2">
          <p class="font-medium text-gray-600">${d.name}</p>
          <label for="${d.id}-file" class="file-input-label flex items-center justify-between w-full px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer">
            <span id="${d.id}-text" class="text-sm text-gray-500">Choose a .csv file</span>
            <span id="${d.id}-status" class="status-dot dot-red"></span>
          </label>
          <input type="file" id="${d.id}-file" class="hidden" accept=".csv">
        </div>`;
      grid.innerHTML += formHtml;
    });
  }

  async function handleFileUpload(dataset) {
    const fileInput = document.getElementById(`${dataset.id}-file`);
    const file = fileInput?.files?.[0];
    if (!file) return;
    const textSpan = document.getElementById(`${dataset.id}-text`);
    if (textSpan) textSpan.textContent = 'Uploading...';
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(dataset.endpoint, { method: 'POST', body: formData });
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.indexOf('application/json') !== -1) {
        const result = await response.json();
        if (response.ok) {
          if (textSpan) textSpan.textContent = file.name;
          document.getElementById(`${dataset.id}-status`)?.classList.replace('dot-red', 'dot-green');
          createStatusIndicators();
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }
    } catch (error) {
      if (textSpan) textSpan.textContent = `Error: ${error.message}`;
      if (fileInput) fileInput.value = '';
    }
  }

  async function fetchAndDisplayRequests() {
    const list = document.getElementById('requests-list');
    if (!list) return;
    try {
      const response = await fetch('/api/admin/cancellation-requests');
      if (!response.ok) throw new Error('Server error');
      const requests = await response.json();
      if (requests.length === 0) {
        list.innerHTML = `<p class="text-sm text-gray-500 text-center p-4">No pending requests.</p>`;
        return;
      }
      list.innerHTML = '';
      requests.forEach(req => {
        const item = document.createElement('div');
        item.className = 'p-3 bg-gray-50 rounded-lg border';
        item.innerHTML = `
          <p class="font-semibold text-gray-800 text-sm">${req.course_name}</p>
          <p class="text-xs text-gray-500">Teacher: ${req.teacher_id} | Slot: ${req.slot}</p>
          <div class="mt-2 flex justify-end space-x-2">
            <button class="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200">Reject</button>
            <button class="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200">Approve</button>
          </div>`;
        const buttons = item.querySelectorAll('button');
        buttons[0].onclick = () => handleRequestAction(req.id, 'reject');
        buttons[1].onclick = () => handleRequestAction(req.id, 'approve');
        list.appendChild(item);
      });
    } catch (error) {
      list.innerHTML = `<p class="text-sm text-red-500 text-center p-4">Could not fetch requests.</p>`;
    }
  }

  async function handleRequestAction(requestId, action) {
    try {
      const response = await fetch('/api/admin/handle-cancellation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: requestId, action })
      });
      if (!response.ok) throw new Error('Failed to process request');
      fetchAndDisplayRequests();
      createStatusIndicators();
    } catch (error) { alert(`Error: ${error.message}`); }
  }

  if (!mounted) return null;
  return (
    <main className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage datasets and generate the master timetable.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="card p-6 bg-white rounded-2xl shadow">
            <h2 className="text-xl font-semibold text-gray-700 border-b pb-3">1. Upload Datasets</h2>
            <div id="upload-grid" className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4"></div>
          </div>
          <div className="card p-6 bg-white rounded-2xl shadow">
            <h2 className="text-xl font-semibold text-gray-700 border-b pb-3">2. Generate Timetable</h2>
            <div className="pt-4">
              <button id="generate-btn" className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all duration-200" onClick={async (e) => {
                const btn = e.currentTarget; const statusDiv = document.getElementById('generate-status');
                if (statusDiv) statusDiv.textContent = 'Generating... This may take a moment.'; btn.setAttribute('disabled','true');
                try {
                  const response = await fetch('/api/admin/generate-timetable', { method: 'POST' });
                  const result = await response.json();
                  if (statusDiv) statusDiv.textContent = response.ok ? `✅ ${result.message} (Score: ${result.best_score})` : `❌ Error: ${result.error}`;
                } catch (error) { if (statusDiv) statusDiv.textContent = '❌ Network Error: Could not connect to the server.'; }
                finally { btn.removeAttribute('disabled'); createStatusIndicators(); }
              }}>Generate Master Timetable</button>
              <div id="generate-status" className="mt-4 text-center text-sm"></div>
            </div>
          </div>
        </div>
        <div className="space-y-8">
          <div className="card p-6 bg-white rounded-2xl shadow">
            <h2 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-4">System Status</h2>
            <div id="status-container" className="space-y-3"></div>
          </div>
          <div className="card p-6 bg-white rounded-2xl shadow">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-xl font-semibold text-gray-700">Cancellation Requests</h2>
              <button id="refresh-requests-btn" className="text-sm text-blue-600 hover:underline" onClick={() => fetchAndDisplayRequests()}>Refresh</button>
            </div>
            <div id="requests-list" className="space-y-3 max-h-96 overflow-y-auto"></div>
          </div>
        </div>
      </div>
      <style>{`.card{box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1),0 2px 4px -2px rgb(0 0 0 / 0.1);} .status-dot{width:8px;height:8px;border-radius:50%}.dot-red{background-color:#ef4444}.dot-green{background-color:#22c55e}`}</style>
    </main>
  );
}
