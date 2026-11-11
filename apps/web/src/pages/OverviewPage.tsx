import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

type ThemePreference = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';
type HealthState =
  | { status: 'loading' }
  | { status: 'connected'; timestamp: string }
  | { status: 'unavailable'; message: string };

interface HealthResponse {
  status: string;
  timestamp: string;
}

const THEME_STORAGE_KEY = 'qfat-theme-preference';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}

function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'dark';
  } catch {
    return 'dark';
  }
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function OverviewPage() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });
  const [retry, setRetry] = useState(0);
  const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  const checkHealth = useCallback(async (signal: AbortSignal) => {
    setHealth({ status: 'loading' });

    try {
      const response = await fetch('/api/v1/health', {
        headers: { Accept: 'application/json' },
        signal,
      });

      if (!response.ok) {
        throw new Error(`Health request returned HTTP ${response.status}.`);
      }

      const result = (await response.json()) as HealthResponse;
      if (result.status !== 'ok' || typeof result.timestamp !== 'string') {
        throw new Error('The backend returned an unexpected health response.');
      }

      setHealth({ status: 'connected', timestamp: result.timestamp });
    } catch (error) {
      if (signal.aborted) return;
      setHealth({
        status: 'unavailable',
        message: error instanceof Error ? error.message : 'The backend health check failed.',
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void checkHealth(controller.signal);
    return () => controller.abort();
  }, [checkHealth, retry]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mediaQuery) return;

    const updateSystemTheme = (event: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(event.matches ? 'light' : 'dark');
    };

    updateSystemTheme(mediaQuery);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateSystemTheme);
    } else {
      mediaQuery.addListener(updateSystemTheme);
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', updateSystemTheme);
      } else {
        mediaQuery.removeListener(updateSystemTheme);
      }
    };
  }, []);

  const resolvedTheme = themePreference === 'system' ? systemTheme : themePreference;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = resolvedTheme === 'dark' ? '#10131b' : '#f4f6fa';
  }, [resolvedTheme]);

  useEffect(() => {
    const syncThemePreference = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && isThemePreference(event.newValue)) {
        setThemePreference(event.newValue);
      }
    };
    window.addEventListener('storage', syncThemePreference);
    return () => window.removeEventListener('storage', syncThemePreference);
  }, []);

  return (
    <div className="page-content">
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumb">
          <li>Workspace</li>
          <li className="breadcrumb-divider" aria-hidden="true">/</li>
          <li aria-current="page">Overview</li>
        </ol>
      </nav>

      <section className="page-intro" aria-labelledby="page-title">
        <div>
          <p className="section-kicker">YOUR WORKSPACE</p>
          <h1 id="page-title">Overview</h1>
          <p className="page-description">
            A clear view of your local QFAT workspace and service status.
          </p>
        </div>
        <div className="local-context-pill">
          <span className="local-context-pulse" aria-hidden="true" />
          Hosted on this PC
        </div>
      </section>

      <div className="overview-grid">
        <section className={`service-card service-card--${health.status}`} aria-labelledby="service-title">
          <div className="card-heading-row">
            <div>
              <p className="card-eyebrow">SERVICE CONNECTION</p>
              <h2 id="service-title">Backend status</h2>
            </div>
            <span className={`status-badge status-badge--${health.status}`}>
              <span className="status-badge-dot" aria-hidden="true" />
              {health.status === 'loading' && 'Checking'}
              {health.status === 'connected' && 'Connected'}
              {health.status === 'unavailable' && 'Unavailable'}
            </span>
          </div>

          <p className="service-description">
            {health.status === 'connected' && 'QFAT can reach the local backend service.'}
            {health.status === 'loading' && 'Checking whether the local backend is responding.'}
            {health.status === 'unavailable' &&
              'The backend is not responding. Make sure its process is running, then try again.'}
          </p>

          <div className="service-footer">
            <span className="last-check">
              {health.status === 'connected' && `Last checked ${new Date(health.timestamp).toLocaleTimeString()}`}
              {health.status === 'loading' && 'Waiting for a response'}
              {health.status === 'unavailable' && health.message}
            </span>
            <button
              className="retry-button"
              type="button"
              onClick={() => setRetry((count) => count + 1)}
              disabled={health.status === 'loading'}
            >
              Retry connection
            </button>
          </div>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            Backend {health.status === 'connected' ? 'connected' : health.status === 'unavailable' ? 'unavailable' : 'connection checking'}
          </span>
        </section>

        <section className="workspace-card" aria-labelledby="workspace-card-title">
          <p className="card-eyebrow">THIS INSTANCE</p>
          <h2 id="workspace-card-title">Your local workspace</h2>
          <p>
            QFAT runs on your PC. Open it from a trusted private network using this PC's address.
          </p>
          <div className="workspace-card-footer">
            <span className="workspace-card-indicator" aria-hidden="true" />
            <span>Private network access</span>
          </div>
        </section>
      </div>

      <section className="first-run-panel" aria-labelledby="first-run-title">
        <div className="empty-state-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="first-run-copy">
          <p className="card-eyebrow">A FRESH START</p>
          <h2 id="first-run-title">Your publishing workspace is ready to take shape</h2>
          <p>
            Account connections and content creation are available. Use the navigation to access Create Content for preparing metadata.
          </p>
        </div>
        <span className="first-run-status">Setup available</span>
      </section>

      <footer className="page-footer">
        <span>QFAT private beta</span>
        <span>Local-first publishing workspace</span>
      </footer>
    </div>
  );
}