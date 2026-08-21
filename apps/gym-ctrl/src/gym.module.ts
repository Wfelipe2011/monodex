import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/infra';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';
import { AuthModule } from './modules/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { InboxRealtimeModule } from './modules/inbox-realtime/inbox-realtime.module';
import { GymController } from './gym.controller';
import { OrphanMediaCleanupCron } from './modules/admin/orphan-media-cleanup.cron';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    InboxRealtimeModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test', 'provision').default('development'),
        GYM_PORT: Joi.number().port().default(3000),
        JWT_SECRET: Joi.string().required().description('Chave secreta para assinatura de tokens JWT'),
        INTERNAL_WS_NOTIFY_SECRET: Joi.string().required().description('Secret compartilhado com notifly para POST /internal/inbox/realtime/notify'),
        WS_INBOX_PATH: Joi.string().default('ws/inbox').description('Path do WebSocket gateway'),
        WS_ALLOWED_ORIGINS: Joi.string().optional().description('Origens CORS WS separadas por vírgula; omitir = permissivo em dev'),
        VAPID_PRIVATE_KEY: Joi.string().required().description('Chave privada VAPID (base64url) para Web Push'),
        VAPID_SUBJECT: Joi.string().required().description('Subject VAPID (mailto: ou URL https)'),
        VAPID_PUBLIC_KEY: Joi.string().optional().description('Chave pública VAPID; omitir = derivada da privada'),
        INVITE_TTL_HOURS: Joi.number().integer().min(1).max(48).default(8),
        INVITE_PUBLIC_BASE_URL: Joi.string().optional(),
        PUBLIC_API_BASE_URL: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().uri().required(),
          otherwise: Joi.string().uri().optional(),
        }).description('Base absoluta HTTPS da API (mídia pública / Graph image.link)'),
        TENANT_MEDIA_DIR: Joi.string()
          .default('uploads/tenant-media')
          .description('Diretório de arquivos de mídia dos tenants'),
      }),
    })],
  controllers: [GymController],
  providers: [OrphanMediaCleanupCron],
})
export class GymModule { }
