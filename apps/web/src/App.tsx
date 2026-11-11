import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

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

const navigationItems = [
  { label: 'Overview', available: true },
  { label: 'Accounts', available: false },
  { label: 'Media Library', available: false },
  { label: 'Create Content', available: false },
  { label: 'Queue', available: false },
  { label: 'History', available: false },
  { label: 'Settings', available: false },
] as const;

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

function Navigation({
  onNavigate,
  overviewRef,
}: {
  onNavigate?: () => void;
  overviewRef?: RefObject<HTMLAnchorElement>;
}) {
  return (
    <nav className="primary-navigation" aria-label="Primary navigation">
      <p className="navigation-heading">WORKSPACE</p>
      <ul className="navigation-list">
        {navigationItems.map((item) => (
          <li key={item.label}>
            {item.available ? (
              <a
                ref={overviewRef}
                className="navigation-link navigation-link--active"
                href="/"
                aria-current="page"
                onClick={onNavigate}
              >
                <span className="navigation-indicator" aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            ) : (
              <button
                className="navigation-link navigation-link--upcoming"
                type="button"
                disabled
                aria-label={`${item.label}, coming soon`}
              >
                <span className="navigation-indicator" aria-hidden="true" />
                <span className="navigation-name">{item.label}</span>
                <span className="navigation-soon">Soon</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });
  const [retry, setRetry] = useState(0);
  const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileOverviewRef = useRef<HTMLAnchorElement>(null);

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

  useEffect(() => {
    if (!mobileMenuOpen) return;
    mobileOverviewRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  const updateThemePreference = (value: string) => {
    if (!isThemePreference(value)) return;
    setThemePreference(value);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // The selected theme remains active for this page even if storage is unavailable.
    }
  };

  return (
    <div className="application-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <aside className="desktop-sidebar" aria-label="Application sidebar">
        <a className="brand-lockup" href="/" aria-label="QFAT Overview">
          <span className="brand-monogram" aria-hidden="true">Q</span>
          <span className="brand-name">QFAT</span>
          <span className="brand-beta">BETA</span>
        </a>

        <div className="workspace-context">
          <span className="workspace-context-label">CURRENT WORKSPACE</span>
          <span className="workspace-context-name">
            <span className="workspace-context-dot" aria-hidden="true" />
            Local workspace
          </span>
          <span className="workspace-context-detail">Running on this PC</span>
        </div>

        <Navigation />

        <div className="sidebar-footer">
          <span className="sidebar-footer-mark" aria-hidden="true" />
          <span>Private network workspace</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            ref={menuButtonRef}
            className="mobile-menu-toggle"
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span className={`menu-glyph ${mobileMenuOpen ? 'menu-glyph--open' : ''}`} aria-hidden="true">
              <span />
              <span />
            </span>
          </button>

          <a className="mobile-brand" href="/" aria-label="QFAT Overview">
            <span className="brand-monogram" aria-hidden="true">Q</span>
            <span className="brand-name">QFAT</span>
          </a>

          <div className="topbar-spacer" />
          <div className="theme-control">
            <label htmlFor="theme-preference">Appearance</label>
            <select
              id="theme-preference"
              value={themePreference}
              onChange={(event) => updateThemePreference(event.target.value)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <span className="topbar-local-tag">
            <span aria-hidden="true" />
            LOCAL
          </span>
        </header>

        <div
          className="mobile-navigation-panel"
          id="mobile-navigation"
          hidden={!mobileMenuOpen}
        >
            <div className="mobile-workspace-context">
              <span className="workspace-context-label">CURRENT WORKSPACE</span>
              <strong>Local workspace</strong>
              <span>Running on this PC</span>
            </div>
            <Navigation
              overviewRef={mobileOverviewRef}
              onNavigate={() => {
                setMobileMenuOpen(false);
                menuButtonRef.current?.focus();
              }}
            />
        </div>

        <main className="main-content" id="main-content" tabIndex={-1}>
          <div className="content-frame">
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
                  QFAT runs on your PC. Open it from a trusted private network using this PC’s address.
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
                  Account connections and content creation are planned for later phases. This Overview
                  will show real workspace activity when those features are available. No accounts,
                  posts, or publishing activity are being shown yet.
                </p>
              </div>
              <span className="first-run-status">Setup not available yet</span>
            </section>

            <footer className="page-footer">
              <span>QFAT private beta</span>
              <span>Local-first publishing workspace</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
