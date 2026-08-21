/**
 * Gera swagger-spec.json sem subir o HTTP server (task docs).
 * Uso: npx ts-node -r tsconfig-paths/register apps/gym-ctrl/src/generate-swagger-spec.ts
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { GymModule } from './gym.module';

async function main() {
  const app = await NestFactory.create(GymModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('Gestão de Leads')
    .setDescription('API para gestão de leads')
    .setVersion('1.0')
    .addTag('leads')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-KEY',
        in: 'header',
        description:
          'Chave do tenant (allowlist). Não combine com Authorization Bearer.',
      },
      'X-API-KEY',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  writeFileSync('swagger-spec.json', JSON.stringify(document, null, 2));
  await app.close();
  console.log('swagger-spec.json regenerated');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
