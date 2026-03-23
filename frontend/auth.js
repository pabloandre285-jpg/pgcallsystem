const API_BASE = "";

function getToken() {
  return localStorage.getItem("pg_token");
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("pg_user") || "null");
  } catch {
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem("pg_token", token);
  localStorage.setItem("pg_user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("pg_token");
  localStorage.removeItem("pg_user");
}

function logout() {
  clearSession();
  window.location.href = "index.html";
}

function isAdmin() {
  const u = getUser();
  return u && u.role === "admin";
}

function canAddUser() {
  const u = getUser();
  return u && u.pode_add_usuario;
}

function authHeaders() {
  const t = getToken();
  const h = { "Content-Type": "application/json" };
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function authFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) }
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = "index.html";
    throw new Error("Sessão expirada");
  }
  return res;
}

function requireAuthPage() {
  if (!getToken()) {
    window.location.href = "index.html";
  }
}
