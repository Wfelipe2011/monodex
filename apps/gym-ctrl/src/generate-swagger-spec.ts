/**
 * Gera swagger-spec.json sem subir o HTTP server (task docs).
 * Uso: npx ts-node -r tsconfig-paths/register apps/gym-ctrl/src/generate-swagger-spec.ts
 */
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { GymModule } from './gym.module';
import {
  SWAGGER_EXTRA_MODELS,
  buildSwaggerDocumentConfig,
} from './swagger/swagger-document.config';
import { enrichSwaggerResponseExamples } from './swagger/enrich-swagger-examples';

async function main() {
  const app = await NestFactory.create(GymModule, { logger: false });
  const config = buildSwaggerDocumentConfig();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: SWAGGER_EXTRA_MODELS,
  });
  enrichSwaggerResponseExamples(document);
  writeFileSync('swagger-spec.json', JSON.stringify(document, null, 2));
  await app.close();
  console.log('swagger-spec.json regenerated');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
