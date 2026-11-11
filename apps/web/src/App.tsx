import { useCallback, useEffect, useState } from 'react';

type HealthState =
  | { status: 'loading' }
  | { status: 'connected'; timestamp: string }
  | { status: 'unavailable'; message: string };

interface HealthResponse {
  status: string;
  timestamp: string;
}

function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });
  const [retry, setRetry] = useState(0);

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
        message:
          error instanceof Error ? error.message : 'The backend health check failed.',
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void checkHealth(controller.signal);
    return () => controller.abort();
  }, [checkHealth, retry]);

  const isConnected = health.status === 'connected';

  return (
    <main className="page-shell">
      <section className="status-card" aria-labelledby="page-title">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">Q</div>
          <span className="brand-name">QFAT</span>
          <span className="beta-label">PRIVATE BETA</span>
        </div>

        <p className="eyebrow">LOCAL PUBLISHING WORKSPACE</p>
        <h1 id="page-title">Your workspace, ready when you are.</h1>
        <p className="intro">
          This QFAT instance is running on your PC. The connection panel shows whether its local
          service is available.
        </p>

        <div
          className={`health-panel health-panel--${health.status}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="health-indicator" aria-hidden="true" />
          <span className="sr-only">Service status:</span>
          <div className="health-copy">
            <span className="health-label">Backend service</span>
            <strong>
              {health.status === 'loading' && 'Checking connection…'}
              {health.status === 'connected' && 'Connected'}
              {health.status === 'unavailable' && 'Unavailable'}
            </strong>
            {health.status === 'connected' && (
              <span className="health-detail">
                Last checked {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            )}
            {health.status === 'unavailable' && (
              <span className="health-detail">{health.message}</span>
            )}
          </div>
          <button
            className="retry-button"
            type="button"
            onClick={() => setRetry((count) => count + 1)}
            disabled={health.status === 'loading'}
          >
            Retry
          </button>
        </div>

        <div className="connection-note">
          <span className={`connection-dot ${isConnected ? 'connection-dot--online' : ''}`} />
          <span>
            {isConnected
              ? 'Your browser can reach the QFAT backend.'
              : 'Connect to the PC network and make sure both QFAT processes are running.'}
          </span>
        </div>
        <footer className="card-footer">
          <span>QFAT</span>
          <span>Private network access</span>
        </footer>
      </section>
      <p className="page-caption">A focused workspace for your publishing workflow.</p>
    </main>
  );
}

export default App;
