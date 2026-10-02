import { inject, isDevMode, LOCALE_ID, provideAppInitializer } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/api';
import { provideServiceWorker } from '@angular/service-worker';
import { AppUpdateService } from './app/core/app-update.service';

registerLocaleData(localeEsAr);

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    provideAppInitializer(() => inject(AppUpdateService).start()),
    { provide: LOCALE_ID, useValue: 'es-AR' }
  ]
}).catch(console.error);
