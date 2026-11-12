import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { BrowserRouter, Link, useLocation, Outlet, NavLink, Routes, Route } from 'react-router-dom';
import { OverviewPage } from './pages/OverviewPage';
import { CreateContentPage } from './pages/CreateContentPage';
import { MediaLibraryPage } from './pages/MediaLibraryPage';
import { securityClient } from './security/client';

type ThemePreference = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'qfat-theme-preference';

const navigationItems = [
  { label: 'Overview', path: '/', available: true },
  { label: 'Accounts', path: '/accounts', available: false },
  { label: 'Media Library', path: '/media', available: true },
  { label: 'Create Content', path: '/create', available: true },
  { label: 'Queue', path: '/queue', available: false },
  { label: 'History', path: '/history', available: false },
  { label: 'Settings', path: '/settings', available: false },
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

function Navigation({ onNavigate, overviewRef }: { onNavigate?: () => void; overviewRef?: RefObject<HTMLAnchorElement> }) {
  const location = useLocation();

  return (
    <nav className="primary-navigation" aria-label="Primary navigation">
      <p className="navigation-heading">WORKSPACE</p>
      <ul className="navigation-list">
        {navigationItems.map((item) => (
          <li key={item.label}>
            {item.available ? (
              <NavLink
                ref={item.path === '/' ? overviewRef : undefined}
                to={item.path}
                className={({ isActive }) =>
                  `navigation-link ${isActive ? 'navigation-link--active' : ''} ${!item.available ? 'navigation-link--upcoming' : ''}`
                }
                aria-current={item.path === location.pathname ? 'page' : undefined}
                onClick={onNavigate}
              >
                <span className="navigation-indicator" aria-hidden="true" />
                <span>{item.label}</span>
                {!item.available && <span className="navigation-soon">Soon</span>}
              </NavLink>
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

function AppShell() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileOverviewRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let isMounted = true;
    securityClient.bootstrap().catch((error) => {
      if (isMounted) {
        console.error('Security bootstrap failed:', error);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

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
        <Link className="brand-lockup" to="/" aria-label="QFAT Overview">
          <span className="brand-monogram" aria-hidden="true">Q</span>
          <span className="brand-name">QFAT</span>
          <span className="brand-beta">BETA</span>
        </Link>

        <div className="workspace-context">
          <span className="workspace-context-label">CURRENT WORKSPACE</span>
          <span className="workspace-context-name">
            <span className="workspace-context-dot" aria-hidden="true" />
            Local workspace
          </span>
          <span className="workspace-context-detail">Running on this PC</span>
        </div>

        <Navigation onNavigate={() => {}} />

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

          <Link className="mobile-brand" to="/" aria-label="QFAT Overview">
            <span className="brand-monogram" aria-hidden="true">Q</span>
            <span className="brand-name">QFAT</span>
          </Link>

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

        <div className="mobile-navigation-panel" id="mobile-navigation" hidden={!mobileMenuOpen}>
          <div className="mobile-workspace-context">
            <span className="workspace-context-label">CURRENT WORKSPACE</span>
            <strong>Local workspace</strong>
            <span>Running on this PC</span>
          </div>
          <Navigation overviewRef={mobileOverviewRef} onNavigate={() => {
            setMobileMenuOpen(false);
            menuButtonRef.current?.focus();
          }} />
        </div>

        <main className="main-content" id="main-content" tabIndex={-1}>
          <div className="content-frame">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="create" element={<CreateContentPage />} />
          <Route path="media" element={<MediaLibraryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;