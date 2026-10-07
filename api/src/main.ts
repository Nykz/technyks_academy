import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import {
  json,
  raw,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { AppModule } from './app/app.module';
import { resolveWebPage } from './web-page';
import { MediaService, getUploadsDirectory } from './app/admin/media.service';

function getWebDirectory() {
  const configuredDirectory = String(process.env.WEB_DIST_DIR || '').trim();
  const candidates = [
    configuredDirectory ? resolve(configuredDirectory) : '',
    resolve(process.cwd(), 'public'),
    resolve(process.cwd(), 'dist', 'public'),
    resolve(process.cwd(), 'public_dist'),
    resolve(__dirname, 'public'),
    resolve(__dirname, '..', 'public'),
    resolve(__dirname, '..', '..', 'public'),
  ].filter(Boolean);

  return candidates.find((directory) =>
    existsSync(join(directory, 'index.html')),
  );
}

function validateProductionEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    if (isProduction) throw new Error('DATABASE_URL is required in production.');
    Logger.warn('[Startup] DATABASE_URL is not set. Development requires ALLOW_IN_MEMORY_FALLBACK=true.', 'Bootstrap');
  } else if (!/^mysql:\/\//i.test(databaseUrl)) {
    Logger.warn(
      '[Startup] DATABASE_URL does not use mysql:// protocol. Please verify database connection string.',
      'Bootstrap',
    );
  }

  const jwtSecret = String(process.env.JWT_SECRET || '').trim();
  if (jwtSecret.length < 32) {
    if (isProduction) throw new Error('JWT_SECRET must contain at least 32 characters in production.');
    Logger.warn(
      '[Startup] JWT_SECRET is missing or shorter than 32 characters. Using an ephemeral development key.',
      'Bootstrap',
    );
    process.env.JWT_SECRET = randomBytes(48).toString('hex');
  }
}

async function bootstrap() {
  Logger.log('[Startup] Technyks API bootstrap() starting...', 'Bootstrap');
  Logger.log(
    `[Startup] NODE_ENV=${process.env.NODE_ENV || 'unset'}, ` +
      `PORT=${process.env.PORT || 'unset'}, ` +
      `API_PORT=${process.env.API_PORT || 'unset'}, ` +
      `DATABASE_URL=${process.env.DATABASE_URL ? 'set (hidden)' : 'NOT SET'}`,
    'Bootstrap',
  );

  validateProductionEnvironment();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Standard secure headers (HSTS, X-Content-Type-Options, X-Frame-Options,
  // X-DNS-Prefetch-Control, etc.). Content-Security-Policy is intentionally
  // left off here rather than guessed at: this app loads Google Fonts, an
  // inline theme-detection script, Bunny/YouTube video iframes, and the
  // Razorpay checkout script, so a CSP needs to be enumerated and tested
  // against all of those before it can be turned on without breaking pages.
  // Cross-Origin-Resource-Policy must allow cross-origin reads because the
  // web app (courses.codingtechnyks.com) and this API (api.codingtechnyks.com)
  // are different origins, and course/template thumbnails + uploaded videos
  // served from here are loaded by <img>/<video> tags on that other origin.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
      // helmet's default "no-referrer" strips the Referer from the Bunny
      // player iframe, so Bunny's "Allowed domains" check rejects every
      // embed. Send only the origin (https://technyks.com) to other sites.
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Google Sign-In opens a popup that reports back to this page;
      // helmet's default "same-origin" blocks that, so the Google button
      // could never complete a login. This is Google's recommended value.
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),
  );

  // Behind a reverse proxy/load balancer (Hostinger, nginx, a CDN) every
  // request otherwise looks like it comes from the proxy's own IP, which
  // would make the rate limiter (and any IP-based logging) treat every
  // visitor as one caller. Trust exactly one hop so req.ip reflects the
  // real client.
  if (process.env.NODE_ENV === 'production') {
    // Hostinger's CDN (and possibly another proxy) sits in front of Node.
    // TRUST_PROXY_HOPS is how many proxies to trust from the right of
    // X-Forwarded-For; the wrong value makes every visitor share one rate
    // limit. 1 is correct for Hostinger (verified: req.ip is the visitor's
    // address and a forged X-Forwarded-For is ignored).
    const hops = Math.max(0, Math.floor(Number(process.env.TRUST_PROXY_HOPS ?? 1)));
    app.getHttpAdapter().getInstance().set('trust proxy', hops);
  }

  // Uploaded images are kept in the database; serve them first and fall
  // back to files on disk (uploaded videos, or local development).
  const mediaService = app.get(MediaService, { strict: false });
  app
    .getHttpAdapter()
    .getInstance()
    .get(
      '/uploads/course-media/:filename',
      async (request: Request, response: Response, next: NextFunction) => {
        try {
          const media = await mediaService.read(String(request.params.filename));
          if (!media) {
            next();
            return;
          }
          // Filenames are unique per upload, so the file never changes.
          response.set({
            'Content-Type': media.mimeType,
            'Content-Length': String(media.data.length),
            'Cache-Control': 'public, max-age=31536000, immutable',
          });
          response.end(media.data);
        } catch (error) {
          next(error);
        }
      },
    );

  const uploadsDirectory = getUploadsDirectory();
  mkdirSync(uploadsDirectory, { recursive: true });
  Logger.log(`[Startup] Uploaded images are stored in the database; uploaded videos in ${uploadsDirectory}`, 'Bootstrap');
  app.useStaticAssets(uploadsDirectory, {
    prefix: '/uploads/',
    index: false,
  });

  const webDirectory = getWebDirectory();
  if (webDirectory) {
    app.useStaticAssets(webDirectory, {
      index: false,
      fallthrough: true,
      // "/privacy-policy" must not bounce to "/privacy-policy/"; the page
      // handler below serves the right HTML for both.
      redirect: false,
    });

    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get(
      /.*/,
      (request: Request, response: Response, next: NextFunction) => {
        const requestPath = request.path;
        const isBackendRoute =
          requestPath === '/api' ||
          requestPath.startsWith('/api/') ||
          requestPath === '/health' ||
          requestPath.startsWith('/uploads/');
        const looksLikeMissingFile = requestPath
          .split('/')
          .pop()
          ?.includes('.');

        if (isBackendRoute || looksLikeMissingFile) {
          next();
          return;
        }

        response.setHeader('Cache-Control', 'no-cache');
        response.sendFile(resolveWebPage(webDirectory, requestPath));
      },
    );
    Logger.log(
      `[Startup] Serving the Technyks web application from ${webDirectory}`,
      'Bootstrap',
    );
  } else {
    Logger.warn(
      '[Startup] Web build was not found. The API will start without the website shell.',
      'Bootstrap',
    );
  }
  // Pieces of large admin uploads arrive as raw bytes (see large-upload.service.ts).
  app.use('/api/admin/uploads', raw({ type: 'application/octet-stream', limit: '9mb' }));
  app.use(json({
    limit: '16mb',
    verify: (request: Request & { rawBody?: Buffer }, _response, buffer) => {
      if (request.path === '/api/payments/webhook' || request.path === '/api/payments/stripe-webhook') {
        request.rawBody = Buffer.from(buffer);
      }
    },
  }));
  app.use(urlencoded({ extended: true, limit: '16mb' }));
  const allowedOrigins = String(
    process.env.CORS_ORIGINS || 'https://technyks.com,https://www.technyks.com',
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? allowedOrigins
        : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Strip/reject unexpected request-body fields and coerce+validate typed
  // ones on every DTO that carries class-validator decorators. Endpoints
  // whose DTOs are still plain interfaces (no decorators) are unaffected —
  // this is the first step of a broader move away from `@Body() dto: any`,
  // not a rewrite of every controller in one pass.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix, {
    exclude: ['/', 'health'],
  });

  const rawPort = process.env.PORT || process.env.API_PORT || 3000;
  const numericPort = Number(rawPort);

  if (!isNaN(numericPort) && numericPort > 0) {
    await app.listen(numericPort, '0.0.0.0');
    Logger.log(
      `🚀 Backend API is running on: http://0.0.0.0:${numericPort}/${globalPrefix}`,
      'Bootstrap',
    );
  } else {
    // Unix domain socket or named pipe provided by host
    await app.listen(rawPort);
    Logger.log(`🚀 Backend API is running on socket: ${rawPort}`, 'Bootstrap');
  }
}

bootstrap().catch((err) => {
  console.error('[FATAL] Technyks API failed to start:', err?.message || err);
  console.error(err);
  process.exit(1);
});
