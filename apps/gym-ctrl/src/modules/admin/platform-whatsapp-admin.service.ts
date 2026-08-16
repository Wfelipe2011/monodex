import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { WhatsappProvider } from '@prisma/client';

export const GRAPH_API_VERSION = 'v23.0';

export type PlatformWhatsappAdminCredentials = {
  accountId: number;
  wabaId: string;
  phoneNumberId: string;
  token: string;
  messagesUrl: string;
};

@Injectable()
export class PlatformWhatsappAdminService {
  private readonly logger = new Logger(PlatformWhatsappAdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveCredentials(): Promise<PlatformWhatsappAdminCredentials> {
    const account = await this.prisma.whatsappAccount.findFirst({
      where: {
        tenantId: null,
        enabled: true,
        provider: WhatsappProvider.CLOUD_API,
      },
    });

    if (!account) {
      throw new NotFoundException(
        'Conta WhatsApp Cloud API da plataforma não encontrada (tenantId=null, enabled=true, provider=CLOUD_API)',
      );
    }

    const token = process.env[account.tokenEnvKey];
    if (!token) {
      throw new BadRequestException(
        `Token WhatsApp ausente: variável de ambiente "${account.tokenEnvKey}" não está definida ou está vazia`,
      );
    }

    const messagesUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${account.phoneNumberId}/messages`;

    this.logger.debug(
      `Credenciais plataforma resolvidas: phoneNumberId=${account.phoneNumberId}, tokenEnvKey=${account.tokenEnvKey}`,
    );

    return {
      accountId: account.id,
      wabaId: account.wabaId ?? '',
      phoneNumberId: account.phoneNumberId,
      token,
      messagesUrl,
    };
  }
}
