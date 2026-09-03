// Lets these same pages be served from a different origin than the API,
// for proving CORS actually works (same-origin requests never trigger it
// at all). Visiting once with ?apiBase=http://host:port remembers it in
// sessionStorage, so it survives the login redirect to index.html/
// admin.html without needing to be repeated in every URL. Pages served
// normally (no query param, e.g. by the API's own Express app) never set
// this, so apiBase stays '' and every fetch stays a plain relative,
// same-origin request exactly as before.
(function rememberApiBaseFromQueryString() {
  const requested = new URLSearchParams(window.location.search).get('apiBase');
  if (requested) sessionStorage.setItem('apiBase', requested);
})();

function getApiBase() {
  return sessionStorage.getItem('apiBase') || '';
}

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

  const res = await fetch(getApiBase() + path, { ...options, headers });
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
