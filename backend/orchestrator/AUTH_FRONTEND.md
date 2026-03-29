# Auth Integration Guide — Frontend

## Overview

There are now two backend services:

| Service | Port | Purpose |
|---------|------|---------|
| Django | 8080 | Login, registration, tokens |
| Orchestrator | 8000 | AI queries, chat history |

The flow is simple: **login via Django → get a token → use it for orchestrator requests**.

---

## Login

```javascript
const response = await fetch('http://localhost:8080/api/auth/login/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // required
  body: JSON.stringify({ username: 'aziz', password: 'yourpassword' })
});
```

Django sets two cookies automatically — you don't need to handle them manually, the browser does it.

---

## Making requests to the orchestrator

Just add `credentials: 'include'` to every fetch — that's it:

```javascript
const r = await fetch('http://localhost:8000/api/runs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    query: 'What healthcare bills exist in Texas?',
    session_id: crypto.randomUUID()
  })
});
```

If the user isn't logged in you'll get a **401**. Redirect them to login.

---

## Token refresh

The access token lasts **90 minutes**. Refresh it before it expires:

```javascript
// Refresh every 85 minutes
setInterval(async () => {
  await fetch('http://localhost:8080/api/auth/token/refresh/', {
    method: 'POST',
    credentials: 'include'
  });
}, 85 * 60 * 1000);
```

Or handle 401s reactively:

```javascript
async function fetchWithAuth(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (res.status === 401) {
    const refreshed = await fetch('http://localhost:8080/api/auth/token/refresh/', {
      method: 'POST',
      credentials: 'include'
    });
    if (refreshed.ok) return fetch(url, { ...options, credentials: 'include' });
    window.location.href = '/login';
  }
  return res;
}
```

---

## Check if logged in (on app load)

```javascript
const res = await fetch('http://localhost:8080/api/auth/authenticated/', {
  credentials: 'include'
});
if (!res.ok) window.location.href = '/login';
```

---

## Logout

```javascript
await fetch('http://localhost:8080/api/auth/logout/', {
  method: 'POST',
  credentials: 'include'
});
window.location.href = '/login';
```

---

## Register

```javascript
await fetch('http://localhost:8080/api/auth/register/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'aziz', password: 'yourpassword' })
});
```

---

## Django endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register/` | Create account |
| POST | `/api/auth/login/` | Login |
| POST | `/api/auth/logout/` | Logout |
| POST | `/api/auth/token/refresh/` | Refresh token |
| GET | `/api/auth/authenticated/` | Check login status |
