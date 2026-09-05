import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  json,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { AppModule } from './app/app.module';
import { getUploadsDirectory } from './app/admin/media.service';

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
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    Logger.warn(
      '[Startup] DATABASE_URL is not set. API will use high-performance in-memory persistence layer.',
      'Bootstrap',
    );
  } else if (!/^mysql:\/\//i.test(databaseUrl)) {
    Logger.warn(
      '[Startup] DATABASE_URL does not use mysql:// protocol. Please verify database connection string.',
      'Bootstrap',
    );
  }

  const jwtSecret = String(process.env.JWT_SECRET || '').trim();
  if (jwtSecret.length < 32) {
    Logger.warn(
      '[Startup] JWT_SECRET is missing or shorter than 32 characters. Using an ephemeral secure key; configure JWT_SECRET to keep sessions across restarts.',
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
  const uploadsDirectory = getUploadsDirectory();
  mkdirSync(uploadsDirectory, { recursive: true });
  app.useStaticAssets(uploadsDirectory, {
    prefix: '/uploads/',
    index: false,
  });

  const webDirectory = getWebDirectory();
  if (webDirectory) {
    app.useStaticAssets(webDirectory, {
      index: false,
      fallthrough: true,
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

        response.sendFile(join(webDirectory, 'index.html'));
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
  app.use(json({ limit: '16mb' }));
  app.use(urlencoded({ extended: true, limit: '16mb' }));
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

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
