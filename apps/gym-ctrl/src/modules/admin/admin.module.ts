import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/infra';
import { AdminHealthController } from './admin-health.controller';
import { CoinsController } from './coins.controller';
import { CoinsService } from './coins.service';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { OutreachConfigController } from './outreach-config.controller';
import { OutreachConfigService } from './outreach-config.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { WhatsappAccountsController } from './whatsapp-accounts.controller';
import { WhatsappAccountsService } from './whatsapp-accounts.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminHealthController,
    TenantsController,
    UsersController,
    CoinsController,
    OutreachConfigController,
    WhatsappAccountsController,
    OpsController,
  ],
  providers: [
    TenantsService,
    UsersService,
    CoinsService,
    OutreachConfigService,
    WhatsappAccountsService,
    OpsService,
  ],
})
export class AdminModule {}
