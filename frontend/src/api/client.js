const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('Сервер недоступен. Запустите backend: cd backend && npm run dev');
  }

  const contentType = res.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  } else if (!res.ok) {
    throw new Error(`Ошибка сервера (${res.status}). Проверьте, что backend запущен.`);
  }

  if (!res.ok) {
    throw new Error(data.error || `Ошибка запроса (${res.status})`);
  }

  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),

  getPets: () => request('/pets'),
  getPet: (id) => request(`/pets/${id}`),
  createPet: (body) => request('/pets', { method: 'POST', body: JSON.stringify(body) }),
  updatePet: (id, body) => request(`/pets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePet: (id) => request(`/pets/${id}`, { method: 'DELETE' }),

  getDiary: (petId) => request(`/pets/${petId}/diary`),
  createDiaryEntry: (petId, body) =>
    request(`/pets/${petId}/diary`, { method: 'POST', body: JSON.stringify(body) }),
  deleteDiaryEntry: (petId, entryId) =>
    request(`/pets/${petId}/diary/${entryId}`, { method: 'DELETE' }),

  getReminders: (petId) => request(`/pets/${petId}/reminders`),
  createReminder: (petId, body) =>
    request(`/pets/${petId}/reminders`, { method: 'POST', body: JSON.stringify(body) }),
  toggleReminder: (petId, reminderId, isDone) =>
    request(`/pets/${petId}/reminders/${reminderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isDone }),
    }),
  deleteReminder: (petId, reminderId) =>
    request(`/pets/${petId}/reminders/${reminderId}`, { method: 'DELETE' }),

  getDocuments: (petId) => request(`/pets/${petId}/documents`),
  uploadDocument: (petId, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/pets/${petId}/documents`, { method: 'POST', body: form });
  },
  deleteDocument: (petId, docId) =>
    request(`/pets/${petId}/documents/${docId}`, { method: 'DELETE' }),
  downloadDocument: (petId, docId) =>
    `${API_BASE}/pets/${petId}/documents/${docId}/download?token=${getToken()}`,

  getFamilyMembers: (petId) => request(`/pets/${petId}/family/members`),
  getFamilyInvites: (petId) => request(`/pets/${petId}/family/invites`),
  inviteFamily: (petId, email) =>
    request(`/pets/${petId}/family/invite`, { method: 'POST', body: JSON.stringify({ email }) }),
  getMyInvites: () => request('/invites/my-invites'),
  getMyReferralLink: () => request('/invites/my-referral-link'),
  regenerateReferralLink: () => request('/invites/my-referral-link/regenerate', { method: 'POST' }),
  getInvitePreview: (token) => request(`/invites/preview/${token}`),
  acceptInvite: (token) => request(`/invites/accept/${token}`, { method: 'POST' }),

  uploadPetPhoto: (petId, file) => {
    const form = new FormData();
    form.append('photo', file);
    return request(`/pets/${petId}/photo`, { method: 'POST', body: form });
  },
  deletePetPhoto: (petId) => request(`/pets/${petId}/photo`, { method: 'DELETE' }),

  getAnalytics: (petId) => request(`/pets/${petId}/analytics`),
  addWeightRecord: (petId, body) =>
    request(`/pets/${petId}/analytics/weight`, { method: 'POST', body: JSON.stringify(body) }),

  getCalendarTasks: (petId) => request(`/pets/${petId}/calendar`),
  createCalendarTask: (petId, body) =>
    request(`/pets/${petId}/calendar`, { method: 'POST', body: JSON.stringify(body) }),
  completeCalendarTask: (petId, taskId) =>
    request(`/pets/${petId}/calendar/${taskId}/complete`, { method: 'PATCH' }),

  getPlans: () => request('/subscription/plans'),
  getSubscriptionStatus: () => request('/subscription/status'),
  subscribe: (planId, paymentMethod) =>
    request('/subscription/subscribe', {
      method: 'POST',
      body: JSON.stringify({ planId, paymentMethod }),
    }),
  cancelSubscription: () => request('/subscription/cancel', { method: 'POST' }),
};
