"use client";
import { useEffect } from 'react';

export default function Page() {
  useEffect(() => { }, []);
  const onSubmit = (e) => {
    e.preventDefault();
    const username = (document.getElementById('username')?.value || '').trim().toUpperCase();
    const err = document.getElementById('error-message');
    err?.classList.add('hidden');
    if (username.startsWith('S-')) {
      sessionStorage.setItem('loggedInUserId', username);
      window.location.href = '/student';
    } else if (username.startsWith('T-')) {
      sessionStorage.setItem('loggedInUserId', username);
      window.location.href = '/teacher';
    } else if (username.startsWith('A-')) {
      sessionStorage.setItem('loggedInUserId', username);
      window.location.href = '/admin';
    } else {
      if (err) { err.textContent = 'Invalid user ID format. Please use S-..., T-..., or A-...'; err.classList.remove('hidden'); }
    }
  };
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold text-gray-800 text-center">Timetable Login</h1>
        <p className="text-center text-gray-500 mt-2">Please enter your user ID.</p>
        <form className="mt-8 space-y-6" onSubmit={onSubmit}>
          <div>
            <label htmlFor="username" className="sr-only">User ID</label>
            <input id="username" name="username" type="text" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., S-001, T-101, A-001" />
          </div>
          <p id="error-message" className="text-red-500 text-sm text-center hidden"></p>
          <div>
            <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Login</button>
          </div>
        </form>
      </div>
    </div>
  );
}
