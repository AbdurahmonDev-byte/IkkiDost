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

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // Serve uploaded product images.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const path = require('path');
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  app.use('/uploads', express.static(uploadDir, { maxAge: '7d', fallthrough: true }));

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
