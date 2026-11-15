import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  const logger = new Logger('Bootstrap');

  const apiPrefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(apiPrefix);

  const origins = (process.env.CORS_ORIGINS || 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Telegram's Mini App SDK is loaded from telegram.org.
          scriptSrc: ["'self'", 'https://telegram.org'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          // Allow the Mini App to run inside Telegram Web (iframe).
          frameAncestors: ["'self'", 'https://web.telegram.org', 'https://*.telegram.org'],
        },
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // Serve uploaded product images.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeFs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  app.use('/uploads', express.static(uploadDir, { maxAge: '7d', fallthrough: true }));

  // Serve the Telegram Mini App (customer + staff web UI) from the same origin
  // as the API. Built by `npm run build -w @ikki-dost/mini-app`.
  const miniAppDir = path.resolve(process.cwd(), process.env.MINI_APP_DIR || '../mini-app/dist');
  const miniAppIndex = path.join(miniAppDir, 'index.html');
  if (nodeFs.existsSync(miniAppIndex)) {
    app.use(
      express.static(miniAppDir, {
        maxAge: '1y',
        immutable: true,
        index: 'index.html',
        setHeaders: (res: { setHeader: (name: string, value: string) => void }, filePath: string) => {
          if (filePath === miniAppIndex) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      }),
    );
    app.use((req: { method: string; path: string }, res: { sendFile: (file: string) => void }, next: () => void) => {
      if (req.method !== 'GET' || req.path.startsWith(`/${apiPrefix}`) || req.path.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(miniAppIndex);
    });
    logger.log(`Mini App served from ${miniAppDir}`);
  } else {
    logger.warn(`Mini App build not found at ${miniAppDir}; serving API only`);
  }

  const config = new DocumentBuilder()
    .setTitle("Ikki Do'st API")
    .setDescription("Ikki Do'st choyxonasi biznes boshqaruv tizimi API hujjatlari")
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`API ready: http://localhost:${port}/${apiPrefix} (docs: /${apiPrefix}/docs)`);
}

bootstrap();
