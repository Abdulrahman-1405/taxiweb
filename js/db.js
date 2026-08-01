/**
 * Silver Taxi API Client
 * Talks to the real backend (Express + MongoDB) instead of localStorage.
 * Keeps the same window.TaxiDB interface the rest of the site already uses,
 * but every method now returns a Promise - callers need to use await.
 */

const TOKEN_KEY = 'taxi_owner_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${window.API_BASE_URL}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    clearToken();
    if (!window.location.pathname.endsWith('owner-login.html')) {
      window.location.href = 'owner-login.html';
    }
  }

  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body */ }

  if (!res.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

const DB = {
  // Auth
  async login(username, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setToken(data.token);
    return data;
  },

  logout() {
    clearToken();
  },

  isLoggedIn() {
    return !!getToken();
  },

  // Settings
  async getSettings() {
    return request('/settings');
  },

  async saveSettings(settings) {
    const result = await request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
    this.notifyTabs();
    return result;
  },

  // Inquiries
  async getInquiries() {
    return request('/inquiries');
  },

  async addInquiry(inquiryData) {
    const result = await request('/inquiries', {
      method: 'POST',
      body: JSON.stringify(inquiryData)
    });
    this.notifyTabs();
    return result;
  },

  async updateInquiryStatus(id, newStatus) {
    const result = await request(`/inquiries/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    this.notifyTabs();
    return result;
  },

  async deleteInquiry(id) {
    const result = await request(`/inquiries/${id}`, { method: 'DELETE' });
    this.notifyTabs();
    return result;
  },

  notifyTabs() {
    window.dispatchEvent(new Event('taxi_db_update'));
  }
};

window.TaxiDB = DB;
