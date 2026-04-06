import { LogLevel, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { SessionMiddleware } from './common/middlewares/cookie-manager.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const cookieSecret = configService.get<string>('COOKIE_SECRET');
  const logLevels: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose'];

  app.useLogger(logLevels);

  app.use(cookieParser.default(cookieSecret));
  const sessionMiddleware = new SessionMiddleware(configService);
  app.use(sessionMiddleware.use.bind(sessionMiddleware));
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-recaptcha-token'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(configService.getOrThrow<number>('PORT'));
}
bootstrap();
