import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { WhatsappAccount, WhatsappProvider } from '@prisma/client';

export const GRAPH_API_VERSION = 'v23.0';

export type PlatformWhatsappCredentials = {
  accountId: number;
  wabaId: string;
  phoneNumberId: string;
  token: string;
  messagesUrl: string;
};

@Injectable()
export class PlatformWhatsappService {
  private readonly logger = new Logger(PlatformWhatsappService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveCredentials(
    tenantId?: number,
  ): Promise<PlatformWhatsappCredentials> {
    if (tenantId != null) {
      const config = await this.prisma.tenantOutreachConfig.findUnique({
        where: { tenantId },
      });

      if (config?.whatsappAccountId) {
        const account = await this.prisma.whatsappAccount.findUnique({
          where: { id: config.whatsappAccountId },
        });

        if (
          !account ||
          !account.enabled ||
          account.provider !== WhatsappProvider.CLOUD_API
        ) {
          const reason = !account
            ? 'conta não encontrada'
            : !account.enabled
              ? 'conta desabilitada'
              : `provider=${account.provider}`;
          const message =
            `Conta WhatsApp dedicada do tenant ${tenantId} (whatsappAccountId=${config.whatsappAccountId}) indisponível (${reason}); ` +
            'envio pelo número default não é permitido';
          this.logger.error(message);
          throw new Error(message);
        }

        return this.credsFromAccount(account);
      }
    }

    const account = await this.prisma.whatsappAccount.findFirst({
      where: {
        isDefault: true,
        enabled: true,
        tenantId: null,
        provider: WhatsappProvider.CLOUD_API,
      },
    });

    if (!account) {
      const message =
        'Conta WhatsApp Cloud API default da plataforma não encontrada (isDefault=true, tenantId=null, enabled=true, provider=CLOUD_API)';
      this.logger.error(message);
      throw new Error(message);
    }

    return this.credsFromAccount(account);
  }

  private credsFromAccount(
    account: WhatsappAccount,
  ): PlatformWhatsappCredentials {
    const token = process.env[account.tokenEnvKey];
    if (!token) {
      const message = `Token WhatsApp ausente: variável de ambiente "${account.tokenEnvKey}" não está definida ou está vazia`;
      this.logger.error(message);
      throw new Error(message);
    }

    const messagesUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${account.phoneNumberId}/messages`;

    this.logger.debug(
      `Credenciais plataforma resolvidas: phoneNumberId=${account.phoneNumberId}, tokenEnvKey=${account.tokenEnvKey}`,
    );

    return {
      accountId: account.id,
      wabaId: account.wabaId,
      phoneNumberId: account.phoneNumberId,
      token,
      messagesUrl,
    };
  }
}
