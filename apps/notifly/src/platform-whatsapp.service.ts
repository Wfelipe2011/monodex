import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { WhatsappProvider } from '@prisma/client';

const GRAPH_API_VERSION = 'v23.0';

export type PlatformWhatsappCredentials = {
  phoneNumberId: string;
  token: string;
  messagesUrl: string;
};

@Injectable()
export class PlatformWhatsappService {
  private readonly logger = new Logger(PlatformWhatsappService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveCredentials(): Promise<PlatformWhatsappCredentials> {
    const account = await this.prisma.whatsappAccount.findFirst({
      where: {
        tenantId: null,
        enabled: true,
        provider: WhatsappProvider.CLOUD_API,
      },
    });

    if (!account) {
      const message =
        'Conta WhatsApp Cloud API da plataforma não encontrada (tenantId=null, enabled=true, provider=CLOUD_API)';
      this.logger.error(message);
      throw new Error(message);
    }

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
      phoneNumberId: account.phoneNumberId,
      token,
      messagesUrl,
    };
  }
}
