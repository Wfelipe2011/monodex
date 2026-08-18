import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/infra';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AuthModule } from './modules/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { InboxRealtimeModule } from './modules/inbox-realtime/inbox-realtime.module';
import { GymController } from './gym.controller';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    InboxRealtimeModule,
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test', 'provision').default('development'),
        GYM_PORT: Joi.number().port().default(3000),
        JWT_SECRET: Joi.string().required().description('Chave secreta para assinatura de tokens JWT'),
        INTERNAL_WS_NOTIFY_SECRET: Joi.string().required().description('Secret compartilhado com notifly para POST /internal/inbox/realtime/notify'),
        WS_INBOX_PATH: Joi.string().default('ws/inbox').description('Path do WebSocket gateway'),
        WS_ALLOWED_ORIGINS: Joi.string().optional().description('Origens CORS WS separadas por vírgula; omitir = permissivo em dev'),
      }),
    })],
  controllers: [GymController],
  providers: [],
})
export class GymModule { }
