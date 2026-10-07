import { bootstrapApplication } from '@angular/platform-browser';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { filter, firstValueFrom, timeout } from 'rxjs';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(async (appRef) => {
    if (typeof document === 'undefined') return;

    // Keep the preloader up until the page the visitor opened has rendered,
    // so a reload never shows a half-built or wrong page first.
    const router = appRef.injector.get(Router);
    if (!router.navigated) {
      await firstValueFrom(
        router.events.pipe(
          filter((event) => event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError),
          timeout(6000),
        ),
      ).catch(() => undefined);
    }

    const revealApplication = () => {
      const preloader = document.getElementById('app-preloader');
      preloader?.classList.add('app-preloader-hidden');
      window.setTimeout(() => preloader?.remove(), 320);
    };

    const fonts = document.fonts;
    if (fonts) {
      fonts
        .load('18px "Material Symbols Outlined"')
        .then((faces) => {
          if (faces.length) {
            document.documentElement.classList.add('material-icons-ready');
          }
        })
        .catch(() => undefined)
        .finally(revealApplication);
      window.setTimeout(revealApplication, 1800);
    } else {
      document.documentElement.classList.add('material-icons-ready');
      requestAnimationFrame(revealApplication);
    }
  })
  .catch((err) => console.error(err));
