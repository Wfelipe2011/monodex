import { NestFactory } from '@nestjs/core';
import { CapturaModule } from './captura.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(CapturaModule);
  const config = new DocumentBuilder()
    .setTitle('Captura API')
    .setDescription('API para captura de dados')
    .addTag('captura')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.CAPTURA_PORT ?? 3200);
}
bootstrap();
