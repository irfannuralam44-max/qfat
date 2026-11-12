const API_BASE = '/api/v1';

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

class SecurityClient {
  private state: SecurityClientState = {
    csrfToken: null,
    expiresAt: null,
  };

  private bootstrapPromise: Promise<SecurityBootstrapResponse> | null = null;

  private get isTokenValid(): boolean {
    if (!this.state.csrfToken || this.state.expiresAt === null) {
      return false;
    }
    return Date.now() < this.state.expiresAt - 5000;
  }

  async bootstrap(): Promise<SecurityBootstrapResponse> {
    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }

    this.bootstrapPromise = (async () => {
      const response = await fetch(`${API_BASE}/security/bootstrap`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Bootstrap failed' }));
        throw new Error(errorData.error || `Bootstrap failed with status ${response.status}`);
      }

      const data = await response.json() as SecurityBootstrapResponse;
      this.state.csrfToken = data.csrfToken;
      this.state.expiresAt = data.expiresAt;
      return data;
    })();

    try {
      const result = await this.bootstrapPromise;
      return result;
    } finally {
      this.bootstrapPromise = null;
    }
  }

  async refresh(): Promise<SecurityBootstrapResponse> {
    const response = await fetch(`${API_BASE}/security/session/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.state.csrfToken || '',
      },
    });

    if (!response.ok) {
      this.clear();
      const errorData = await response.json().catch(() => ({ error: 'Refresh failed' }));
      throw new Error(errorData.error || `Refresh failed with status ${response.status}`);
    }

    const data = await response.json() as SecurityBootstrapResponse;
    this.state.csrfToken = data.csrfToken;
    this.state.expiresAt = data.expiresAt;
    return data;
  }

  async destroy(): Promise<void> {
    try {
      await fetch(`${API_BASE}/security/session/destroy`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken || '',
        },
      });
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
    if (this.isTokenValid) {
      return this.state.csrfToken!;
    }
    const result = await this.bootstrap();
    return result.csrfToken;
  }

  async requestWithCsrf<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const csrfToken = await this.getCsrfTokenOrBootstrap();

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
    });

    if (response.status === 401) {
      this.clear();
      const retryCsrfToken = await this.bootstrap();
      const retryResponse = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          ...options.headers,
          'Content-Type': 'application/json',
          'X-CSRF-Token': retryCsrfToken.csrfToken,
        },
      });

      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => ({ error: 'Request failed after re-authentication' }));
        throw new Error(errorData.error || `Request failed with status ${retryResponse.status}`);
      }
      return retryResponse.json() as Promise<T>;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
}

export const securityClient = new SecurityClient();

export function createApiHelper() {
  return {
    async get<T>(url: string): Promise<T> {
      return securityClient.requestWithCsrf<T>(url, { method: 'GET' });
    },
    async post<T>(url: string, body: unknown): Promise<T> {
      return securityClient.requestWithCsrf<T>(url, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    async patch<T>(url: string, body: unknown): Promise<T> {
      return securityClient.requestWithCsrf<T>(url, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    async delete<T>(url: string): Promise<T> {
      return securityClient.requestWithCsrf<T>(url, { method: 'DELETE' });
    },
  };
}