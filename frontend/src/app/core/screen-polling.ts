/** A timer owned by one mounted screen. No timer or listener exists before activation. */
export function startScreenPolling(
  refresh: () => void | Promise<void>,
  intervalMs = 60_000,
  ready: () => boolean = () => true
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let running = false;
  let lastCompleted = Date.now();
  const usable = () => document.visibilityState === 'visible' && navigator.onLine && ready();
  const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  const schedule = () => {
    clear();
    if (!stopped && !running && usable()) timer = setTimeout(run, intervalMs);
  };
  const run = async () => {
    clear();
    if (stopped || running || !usable()) return;
    running = true;
    try { await refresh(); }
    catch (error) { console.error('Screen refresh failed', error); }
    finally { running = false; lastCompleted = Date.now(); schedule(); }
  };
  const resume = () => {
    clear();
    if (stopped || running || !usable()) return;
    if (Date.now() - lastCompleted >= intervalMs) void run();
    else schedule();
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  window.addEventListener('offline', resume);
  schedule();
  return () => {
    stopped = true;
    clear();
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener('offline', resume);
  };
}
