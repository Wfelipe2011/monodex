import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/infra';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AuthModule } from './modules/auth.module';
import { GymController } from './gym.controller';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test', 'provision').default('development'),
        PORT: Joi.number().port().default(3000),
        JWT_SECRET: Joi.string().required().description('Chave secreta para assinatura de tokens JWT'),
      }),
    })],
  controllers: [GymController],
  providers: [],
})
export class GymModule { }
