import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'courses',
    renderMode: RenderMode.Server,
  },
  {
    path: 'courses/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'courses/:slug/watch/:lessonId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard',
    renderMode: RenderMode.Client,
  },
  {
    path: 'onboarding',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/courses/:id/manage',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/templates/:id/manage',
    renderMode: RenderMode.Client,
  },
  {
    path: 'checkout',
    renderMode: RenderMode.Client,
  },
  {
    path: 'templates',
    renderMode: RenderMode.Client,
  },
  {
    path: 'templates/:slug',
    renderMode: RenderMode.Client,
  },
  {
    path: 'cart',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
