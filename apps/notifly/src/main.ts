import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const config = new DocumentBuilder()
    .setTitle('Notifly API')
    .setDescription('API para gestão de notificações')
    .addTag('notifications')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  const allowedOrigins: string[] =
    process.env.NOTIFLY_ALLOWED_ORIGINS?.split(',') ||
    [];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Type'],
    credentials: true,
    optionsSuccessStatus: 200
  });

  await app.listen(process.env.NOTIFLY_PORT ?? 3100, () => {
    console.log(`Notifly API is running on port ${process.env.NOTIFLY_PORT ?? 3100}`);
  });
}
bootstrap();
