function getToken() {
  return localStorage.getItem('token');
}

function getRole() {
  return localStorage.getItem('role');
}

function getEmail() {
  return localStorage.getItem('email');
}

function saveSession({ token, role, email }) {
  localStorage.setItem('token', token);
  localStorage.setItem('role', role);
  if (email) localStorage.setItem('email', email);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('email');
  window.location.href = '/login.html';
}

function requireRole(role) {
  if (!getToken() || getRole() !== role) {
    window.location.href = '/login.html';
  }
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  let body = null;
  try {
    body = await res.json();
  } catch (err) {
    body = null;
  }

  if (!res.ok) {
    throw new Error((body && body.message) || `Request failed (${res.status})`);
  }
  return body;
}
