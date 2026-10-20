export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('X-XMonitor-Request', 'true');

  const token = typeof window !== 'undefined' ? localStorage.getItem('xmonitor_token') : null;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  const newToken = res.headers.get('x-new-token');
  if (newToken && typeof window !== 'undefined') {
    localStorage.setItem('xmonitor_token', newToken);
  }

  if (res.status === 401 && !endpoint.includes('/api/auth/status') && !endpoint.includes('/api/auth/login')) {
    window.dispatchEvent(new CustomEvent('auth-unauthorized'));
  }

  if (!res.ok) {
    let errMsg = `خطای سرور (${res.status})`;
    try {
      const errJson = await res.json();
      errMsg = errJson.error || errJson.message || errMsg;
    } catch {
      errMsg = await res.text();
    }
    throw new Error(errMsg);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}
