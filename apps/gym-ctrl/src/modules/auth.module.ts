import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '@core/guard/auth.guard';
import { RolesGuard } from '@core/guard/roles.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService, 
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthModule { }
