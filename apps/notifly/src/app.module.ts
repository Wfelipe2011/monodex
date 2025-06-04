import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtGuard } from './guards/jwt.guard';
import { JwtStrategy } from './guards/strategies/jwt.strategy';
import { ConfigModule } from '@nestjs/config';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { PrismaModule } from '@core/infra';

@Module({
  imports: [
    ConfigModule.forRoot(),
    WhatsappModule,
    WebsocketModule,
    PrismaModule
  ],
  controllers: [],
  providers: [
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtGuard
    }
  ],
})
export class AppModule {
}
