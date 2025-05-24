import { NestFactory } from '@nestjs/core';
import { NotiflyModule } from './notifly.module';

async function bootstrap() {
  const app = await NestFactory.create(NotiflyModule);
  await app.listen(3000);
}
bootstrap();
