import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GymModule } from './gym.module';
import { ConfigService } from '@nestjs/config';


async function bootstrap() {
  const app = await NestFactory.create(GymModule);
  app.enableCors({
    origin: '*', // Permite todas as origens
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Métodos permitidos
    allowedHeaders: 'Content-Type, Authorization', // Cabeçalhos permitidos
  });
  const configService = app.get(ConfigService);
  const config = new DocumentBuilder()
    .setTitle('Gestão de Leads')  
    .setDescription('API para gestão de leads')
    .setVersion('1.0')
    .addTag('leads')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(configService.get('GYM_PORT'), () => {
    console.log(`API running on port ${configService.get('GYM_PORT')}`);
  });
}
bootstrap();
