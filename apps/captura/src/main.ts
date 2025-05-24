import { NestFactory } from '@nestjs/core';
import { CapturaModule } from './captura.module';

async function bootstrap() {
  const app = await NestFactory.create(CapturaModule);
  await app.listen(3000);
}
bootstrap();
