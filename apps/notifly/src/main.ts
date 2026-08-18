/**
 * Env vars para realtime inbox (deploy conjunto com gym-ctrl):
 * - GYM_CTRL_BASE_URL (obrigatória em PRD) — ex.: http://localhost:3000
 * - INTERNAL_WS_NOTIFY_SECRET (obrigatória) — mesmo valor configurado no gym-ctrl
 */
import "dotenv/config";
import { NestFactory } from '@nestjs/core';
import { NotiflyModule } from './notifly.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(NotiflyModule);
  const config = new DocumentBuilder()
    .setTitle('Notifly API')
    .setDescription('API para gestão de notificações')
    .addTag('notifications')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.NOTIFLY_PORT ?? 3100);
}
bootstrap();
