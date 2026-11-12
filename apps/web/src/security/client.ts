const API_BASE = '/api/v1';

function assertApiPath(url: string): void {
  try {
    const parsed = new URL(url, 'http://qfat.invalid');
    if (
      parsed.origin !== 'http://qfat.invalid' ||
      (parsed.pathname !== API_BASE && !parsed.pathname.startsWith(`${API_BASE}/`))
    ) {
      throw new Error('Security client requests must target a relative QFAT API path.');
    }
  } catch {
    throw new Error('Security client requests must target a relative QFAT API path.');
  }
}

export interface SecurityBootstrapResponse {
  csrfToken: string;
  expiresAt: number;
}

export interface SecurityErrorResponse {
  error: string;
}

export interface SecurityClientState {
  csrfToken: string | null;
  expiresAt: number | null;
}

function readError(response: Response, fallback: string): Promise<SecurityErrorResponse> {
  return response.json().catch(() => ({ error: fallback }));
}

function validateBootstrapResponse(data: SecurityBootstrapResponse): SecurityBootstrapResponse {
  if (
    !data ||
    typeof data.csrfToken !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(data.csrfToken) ||
    typeof data.expiresAt !== 'number' ||
    !Number.isFinite(data.expiresAt) ||
    data.expiresAt <= Date.now()
  ) {
    throw new Error('Security bootstrap returned an invalid response.');
  }
  return data;
}

export class SecurityClient {
  private state: SecurityClientState = {
    csrfToken: null,
    expiresAt: null,
  };

  private bootstrapPromise: Promise<SecurityBootstrapResponse> | null = null;

  private get isTokenValid(): boolean {
    return Boolean(
      this.state.csrfToken &&
      this.state.expiresAt !== null &&
      Date.now() < this.state.expiresAt - 5_000
    );
  }

  async bootstrap(): Promise<SecurityBootstrapResponse> {
    if (this.bootstrapPromise) return this.bootstrapPromise;

    this.bootstrapPromise = (async () => {
      const response = await fetch(`${API_BASE}/security/bootstrap`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await readError(response, 'Security bootstrap failed.');
        throw new Error(errorData.error || `Security bootstrap failed (${response.status}).`);
      }

      const data = validateBootstrapResponse(await response.json() as SecurityBootstrapResponse);
      this.state.csrfToken = data.csrfToken;
      this.state.expiresAt = data.expiresAt;
      return data;
    })();

    try {
      return await this.bootstrapPromise;
    } catch (error) {
      this.clear();
      throw error;
    } finally {
      this.bootstrapPromise = null;
    }
  }

  async refresh(): Promise<SecurityBootstrapResponse> {
    const csrfToken = await this.getCsrfTokenOrBootstrap();
    const response = await fetch(`${API_BASE}/security/session/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
    });

    if (!response.ok) {
      this.clear();
      const errorData = await readError(response, 'Security session refresh failed.');
      throw new Error(errorData.error || `Security session refresh failed (${response.status}).`);
    }

    const data = validateBootstrapResponse(await response.json() as SecurityBootstrapResponse);
    this.state.csrfToken = data.csrfToken;
    this.state.expiresAt = data.expiresAt;
    return data;
  }

  async destroy(): Promise<void> {
    try {
      const csrfToken = await this.getCsrfTokenOrBootstrap();
      const response = await fetch(`${API_BASE}/security/session/destroy`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });
      if (!response.ok) {
        const errorData = await readError(response, 'Security session destroy failed.');
        throw new Error(errorData.error || `Security session destroy failed (${response.status}).`);
      }
    } finally {
      this.clear();
    }
  }

  clear(): void {
    this.state.csrfToken = null;
    this.state.expiresAt = null;
  }

  getCsrfToken(): string | null {
    return this.state.csrfToken;
  }

  getExpiresAt(): number | null {
    return this.state.expiresAt;
  }

  hasValidToken(): boolean {
    return this.isTokenValid;
  }

  async getCsrfTokenOrBootstrap(): Promise<string> {
    if (this.isTokenValid) return this.state.csrfToken!;
    return (await this.bootstrap()).csrfToken;
  }

  async requestRead<T>(url: string): Promise<T> {
    assertApiPath(url);
    const response = await fetch(url, { method: 'GET', credentials: 'include' });
    if (!response.ok) {
      const errorData = await readError(response, 'Request failed.');
      throw new Error(errorData.error || `Request failed (${response.status}).`);
    }
    return response.json() as Promise<T>;
  }

  async requestWithCsrf<T>(url: string, options: RequestInit = {}): Promise<T> {
    assertApiPath(url);
    const method = (options.method || 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      throw new Error('CSRF helper only supports state-changing HTTP methods.');
    }

    const send = async (csrfToken: string): Promise<Response> => {
      const headers = new Headers(options.headers);
      if (options.body !== undefined && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      headers.set('X-CSRF-Token', csrfToken);
      return fetch(url, {
        ...options,
        method,
        credentials: 'include',
        headers,
      });
    };

    let response = await send(await this.getCsrfTokenOrBootstrap());
    if (response.status === 401) {
      this.clear();
      const refreshed = await this.bootstrap();
      response = await send(refreshed.csrfToken);
    }

    if (!response.ok) {
      const errorData = await readError(response, 'Request failed.');
      throw new Error(errorData.error || `Request failed (${response.status}).`);
    }

    return response.json() as Promise<T>;
  }
}

export const securityClient = new SecurityClient();

export function createApiHelper() {
  return {
    get<T>(url: string): Promise<T> {
      return securityClient.requestRead<T>(url);
    },
    post<T>(url: string, body: unknown): Promise<T> {
      return securityClient.requestWithCsrf<T>(url, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    patch<T>(url: string, body: unknown): Promise<T> {
      return securityClient.requestWithCsrf<T>(url, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    delete<T>(url: string): Promise<T> {
      return securityClient.requestWithCsrf<T>(url, { method: 'DELETE' });
    },
  };
}
