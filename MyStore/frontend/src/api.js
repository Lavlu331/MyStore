// Small fetch wrapper: adds the JWT token and turns errors into exceptions with the server's message
export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The server says this login is no longer valid (expired token, deactivated account): sign out
    if (res.status === 401 && data.code === 'AUTH_EXPIRED') window.dispatchEvent(new Event('auth:expired'));
    const err = new Error(data.message || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

// Sends one image file as multipart form data and returns the server's JSON answer
export async function uploadFile(path, file) {
  const token = localStorage.getItem('token');
  const body = new FormData();
  body.append('image', file);
  const res = await fetch(`/api${path}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Upload failed');
  return data;
}

// Uploads one image file (admin only) and returns { url }
export const upload = (file) => uploadFile('/uploads', file);
