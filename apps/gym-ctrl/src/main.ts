import { NestFactory } from '@nestjs/core';
import { GymCtrlModule } from './gym-ctrl.module';

async function bootstrap() {
  const app = await NestFactory.create(GymCtrlModule);
  await app.listen(3000);
}
bootstrap();
