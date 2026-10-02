import { ApplicationRef, DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, first, fromEvent, interval, merge, throttleTime } from 'rxjs';

const UPDATE_INTERVAL_MS = 45 * 60 * 1000;
const FOCUS_CHECK_THROTTLE_MS = 60 * 1000;
const RELOAD_GUARD_KEY = 'lodelprofe:pwa-reload';
const RELOAD_GUARD_WINDOW_MS = 5 * 60 * 1000;
const UPDATE_RELEASE = 'pwa-update-1';

type ReloadGuard = { reason: string; at: number };

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly appRef = inject(ApplicationRef);
  private readonly swUpdate = inject(SwUpdate);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;
  private checking = false;
  private reloading = false;

  start() {
    if (this.started || !this.swUpdate.isEnabled) return;
    this.started = true;
    console.info('[pwa] Coordinador de actualizaciones listo.', UPDATE_RELEASE);

    this.swUpdate.versionUpdates.pipe(
      filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(event => this.reloadOnce(`version:${event.latestVersion.hash}`));

    this.swUpdate.unrecoverable.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(event => {
      console.error('[pwa] La versión almacenada no se puede recuperar.', event.reason);
      this.reloadOnce('unrecoverable');
    });

    this.appRef.isStable.pipe(
      filter(Boolean),
      first(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      void this.checkForUpdate();

      interval(UPDATE_INTERVAL_MS).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(() => void this.checkForUpdate());

      merge(fromEvent(window, 'focus'), fromEvent(window, 'online')).pipe(
        throttleTime(FOCUS_CHECK_THROTTLE_MS, undefined, { leading: true, trailing: false }),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(() => void this.checkForUpdate());
    });
  }

  private async checkForUpdate() {
    if (this.checking) return;
    this.checking = true;
    try {
      await this.swUpdate.checkForUpdate();
    } catch (error) {
      console.warn('[pwa] No se pudo comprobar si hay una actualización.', error);
    } finally {
      this.checking = false;
    }
  }

  private reloadOnce(reason: string) {
    if (this.reloading) return;

    const now = Date.now();
    const previous = this.readReloadGuard();
    if (previous?.reason === reason && now - previous.at < RELOAD_GUARD_WINDOW_MS) {
      console.warn('[pwa] Se evitó una recarga repetida.', reason);
      return;
    }

    this.reloading = true;
    try {
      sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify({ reason, at: now } satisfies ReloadGuard));
    } catch (error) {
      console.warn('[pwa] No se pudo guardar la protección contra recargas repetidas.', error);
    }
    document.location.reload();
  }

  private readReloadGuard(): ReloadGuard | null {
    try {
      const value = JSON.parse(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 'null') as Partial<ReloadGuard> | null;
      return typeof value?.reason === 'string' && typeof value.at === 'number'
        ? { reason: value.reason, at: value.at }
        : null;
    } catch {
      return null;
    }
  }
}
