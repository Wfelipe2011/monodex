import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GymCtrlModule } from './gym-ctrl.module';


async function bootstrap() {
  const app = await NestFactory.create(GymCtrlModule);

  const config = new DocumentBuilder()
    .setTitle('Gestão de Leads')  
    .setDescription('API para gestão de leads')
    .setVersion('1.0')
    .addTag('leads')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.GYM_PORT ?? 3000);
}
bootstrap();
