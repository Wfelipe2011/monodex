import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import {
  Prisma,
  WhatsappConversationDirection,
} from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { isDedicatedPlatformAccount } from '@core/shared/whatsapp-conversation';
import { PlatformWhatsappAdminService } from './platform-whatsapp-admin.service';
import { SendConversationMessageDto } from './dto/send-conversation-message.dto';

const MESSAGE_SELECT = {
  id: true,
  wamid: true,
  direction: true,
  type: true,
  body: true,
  createdAt: true,
} satisfies Prisma.WhatsappConversationMessageSelect;

const LAST_MESSAGE_SELECT = {
  id: true,
  direction: true,
  type: true,
  body: true,
  createdAt: true,
} satisfies Prisma.WhatsappConversationMessageSelect;

const MAX_TEXT_LENGTH = 4096;

type GraphSendResponse = {
  messaging_product?: string;
  contacts?: { input?: string; wa_id?: string }[];
  messages?: { id?: string; message_status?: string }[];
};

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly platformWhatsapp: PlatformWhatsappAdminService,
  ) {}

  async listConversations(tenantId: number) {
    await this.assertTenantExists(tenantId);

    const windowStart = subHours(new Date(), 24);
    const threads = await this.prisma.whatsappConversation.findMany({
      where: { tenantId },
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        phone: true,
        displayName: true,
        lastMessageAt: true,
        lastInboundAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: LAST_MESSAGE_SELECT,
        },
      },
    });

    return threads.map(({ messages, lastInboundAt, ...rest }) => ({
      ...rest,
      lastInboundAt,
      windowOpen:
        lastInboundAt != null && lastInboundAt >= windowStart,
      lastMessage: messages[0] ?? null,
    }));
  }

  async listMessages(
    tenantId: number,
    conversationId: number,
    since?: string,
  ) {
    await this.getConversationOrThrow(tenantId, conversationId);

    let sinceDate: Date | undefined;
    if (since !== undefined && since !== '') {
      sinceDate = new Date(since);
      if (Number.isNaN(sinceDate.getTime())) {
        throw new BadRequestException('since deve ser ISO8601 válido');
      }
    }

    return this.prisma.whatsappConversationMessage.findMany({
      where: {
        conversationId,
        ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
      },
      select: MESSAGE_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendTextMessage(
    tenantId: number,
    conversationId: number,
    dto: SendConversationMessageDto,
  ) {
    const conversation = await this.getConversationOrThrow(
      tenantId,
      conversationId,
    );
    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('text não pode ser vazio');
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new BadRequestException(
        `text excede o limite de ${MAX_TEXT_LENGTH} caracteres`,
      );
    }

    await this.assertDedicatedAccount(tenantId);

    const windowStart = subHours(new Date(), 24);
    const lastInbound = await this.prisma.whatsappConversationMessage.findFirst(
      {
        where: {
          conversationId: conversation.id,
          direction: WhatsappConversationDirection.IN,
          createdAt: { gte: windowStart },
        },
        orderBy: { createdAt: 'desc' },
      },
    );
    if (!lastInbound) {
      throw new BadRequestException('OUTSIDE_MESSAGING_WINDOW');
    }

    const creds = await this.platformWhatsapp.resolveCredentials(tenantId);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: conversation.phone,
      type: 'text',
      text: { body: text },
    };

    this.logger.log(
      `send-text tenant=${tenantId} conversation=${conversationId} to=${conversation.phone}`,
    );

    let graphResponse: GraphSendResponse;
    try {
      const res = await this.httpService.axiosRef.post<GraphSendResponse>(
        creds.messagesUrl,
        payload,
        {
          headers: {
            Authorization: `Bearer ${creds.token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      graphResponse = res.data;
    } catch (error) {
      this.rethrowGraphError(error);
    }

    const wamid = graphResponse.messages?.[0]?.id;
    if (!wamid) {
      throw new BadGatewayException(
        'Graph API não retornou wamid para mensagem de texto',
      );
    }

    const created = await this.prisma.whatsappConversationMessage.create({
      data: {
        wamid,
        direction: WhatsappConversationDirection.OUT,
        type: 'text',
        body: text,
        raw: graphResponse as unknown as Prisma.InputJsonValue,
        phone: conversation.phone,
        tenantId,
        conversationId: conversation.id,
      },
      select: MESSAGE_SELECT,
    });

    await this.prisma.whatsappConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: created.createdAt },
    });

    return created;
  }

  private async assertTenantExists(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }
  }

  private async getConversationOrThrow(
    tenantId: number,
    conversationId: number,
  ) {
    const conversation = await this.prisma.whatsappConversation.findFirst({
      where: { id: conversationId, tenantId },
      select: {
        id: true,
        phone: true,
      },
    });
    if (!conversation) {
      throw new NotFoundException(
        `Conversação id=${conversationId} não encontrada para tenant ${tenantId}`,
      );
    }
    return conversation;
  }

  private async assertDedicatedAccount(tenantId: number) {
    const config = await this.prisma.tenantOutreachConfig.findUnique({
      where: { tenantId },
      select: {
        whatsappAccountId: true,
        whatsappAccount: { select: { isDefault: true } },
      },
    });
    if (
      config?.whatsappAccountId == null ||
      !config.whatsappAccount ||
      !isDedicatedPlatformAccount(config.whatsappAccount)
    ) {
      throw new BadRequestException(
        'Tenant sem número WhatsApp dedicado',
      );
    }
  }

  private rethrowGraphError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const payload = error.response?.data as
        | { error?: { message?: string } }
        | undefined;
      const message =
        payload?.error?.message ?? error.message ?? 'erro desconhecido';
      if (status && status >= 400 && status < 500) {
        throw new BadRequestException(`Graph API: ${message}`);
      }
      throw new BadGatewayException(`Graph API: ${message}`);
    }
    throw error;
  }
}

function subHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}
