import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import {
  SWAGGER_EXTRA_MODELS,
  buildSwaggerDocumentConfig,
} from './swagger/swagger-document.config';
import { enrichSwaggerResponseExamples } from './swagger/enrich-swagger-examples';
import { WsAdapter } from '@nestjs/platform-ws';
import { GymModule } from './gym.module';
import { ConfigService } from '@nestjs/config';
import { writeFileSync } from 'fs';


async function bootstrap() {
  const app = await NestFactory.create(GymModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors({
    origin: '*', // Permite todas as origens
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Métodos permitidos
    allowedHeaders: 'Content-Type, Authorization, X-API-KEY', // Cabeçalhos permitidos
  });
  const configService = app.get(ConfigService);
  const config = buildSwaggerDocumentConfig();
  const documentFactory = () => {
    const doc = SwaggerModule.createDocument(app, config, {
      extraModels: SWAGGER_EXTRA_MODELS,
    });
    enrichSwaggerResponseExamples(doc);
    return doc;
  };
  SwaggerModule.setup('api', app, documentFactory);

  writeFileSync('swagger-spec.json', JSON.stringify(documentFactory(), null, 2));

  await app.listen(configService.get('GYM_PORT'), () => {
    console.log(`API running on port ${configService.get('GYM_PORT')}`);
  });
}
bootstrap();
