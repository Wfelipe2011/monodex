import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@core/infra';
import { AdminHealthController } from './admin-health.controller';
import { CoinsController, TenantCoinsController } from './coins.controller';
import { CoinsService } from './coins.service';
import { OpsController, TenantLeadsStatsController } from './ops.controller';
import { OpsService } from './ops.service';
import {
  OutreachConfigController,
  TenantOutreachConfigController,
} from './outreach-config.controller';
import { OutreachConfigService } from './outreach-config.service';
import {
  PlatformOutreachSendsController,
  TenantOutreachSendsController,
} from './outreach-sends.controller';
import { OutreachSendsService } from './outreach-sends.service';
import { TenantsController, TenantSelfController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { UsersController, TenantUsersController } from './users.controller';
import { UsersService } from './users.service';
import { WhatsappAccountsController } from './whatsapp-accounts.controller';
import { WhatsappAccountsService } from './whatsapp-accounts.service';
import { PlatformJobSchedulesController } from './platform-job-schedules.controller';
import { PlatformJobSchedulesService } from './platform-job-schedules.service';
import { PlatformWhatsappAdminService } from './platform-whatsapp-admin.service';
import { ScrapeTargetsController } from './scrape-targets.controller';
import { ScrapeTargetsService } from './scrape-targets.service';
import { ScrapeCoveragesController } from './scrape-coverages.controller';
import { ScrapeCoveragesService } from './scrape-coverages.service';
import { WhatsappTemplatesController } from './whatsapp-templates.controller';
import { WhatsappTemplatesService } from './whatsapp-templates.service';
import {
  LeadListsController,
  PlatformLeadListsController,
  TenantCategorySuggestionsController,
} from './lead-lists.controller';
import { LeadListsService } from './lead-lists.service';
import {
  ListCampaignsController,
  ListSendsController,
} from './list-campaigns.controller';
import { ListCampaignsService } from './list-campaigns.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { TenantActiveGuard } from '@core/guard/tenant-active.guard';
import { TenantScopeGuard } from '@core/guard/tenant-scope.guard';
import {
  SendPolicyController,
  TenantSendPolicyController,
} from './send-policy.controller';
import { SendPolicyService } from './send-policy.service';
import { TemplateGrantsController } from './template-grants.controller';
import { TemplateGrantsService } from './template-grants.service';
import { TenantTemplatesController } from './tenant-templates.controller';
import { TenantScrapeTargetsController } from './tenant-scrape-targets.controller';
import { TenantScrapeTargetsService } from './tenant-scrape-targets.service';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [
    AdminHealthController,
    TenantsController,
    TenantSelfController,
    UsersController,
    TenantUsersController,
    CoinsController,
    TenantCoinsController,
    OutreachConfigController,
    TenantOutreachConfigController,
    TenantOutreachSendsController,
    PlatformOutreachSendsController,
    WhatsappAccountsController,
    WhatsappTemplatesController,
    PlatformJobSchedulesController,
    ScrapeTargetsController,
    ScrapeCoveragesController,
    LeadListsController,
    PlatformLeadListsController,
    TenantCategorySuggestionsController,
    ListCampaignsController,
    ListSendsController,
    ConversationsController,
    OpsController,
    TenantLeadsStatsController,
    SendPolicyController,
    TenantSendPolicyController,
    TemplateGrantsController,
    TenantTemplatesController,
    TenantScrapeTargetsController,
  ],
  providers: [
    TenantsService,
    UsersService,
    CoinsService,
    OutreachConfigService,
    OutreachSendsService,
    WhatsappAccountsService,
    WhatsappTemplatesService,
    PlatformWhatsappAdminService,
    PlatformJobSchedulesService,
    ScrapeTargetsService,
    TenantScrapeTargetsService,
    ScrapeCoveragesService,
    LeadListsService,
    ListCampaignsService,
    ConversationsService,
    OpsService,
    SendPolicyService,
    TemplateGrantsService,
    TenantScopeGuard,
    TenantActiveGuard,
  ],
})
export class AdminModule {}
