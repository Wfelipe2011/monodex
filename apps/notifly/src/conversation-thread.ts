import {
  Prisma,
  WhatsappConversationDirection,
} from '@prisma/client';
import {
  isDedicatedPlatformAccount,
  resolveConversationDisplayName,
} from '@core/shared/whatsapp-conversation';

type ConversationStore = Pick<
  Prisma.TransactionClient,
  | 'whatsappAccount'
  | 'tenantOutreachConfig'
  | 'whatsappConversation'
  | 'whatsappConversationMessage'
>;

export async function isDedicatedBoundToTenant(
  db: ConversationStore,
  tenantId: number,
  lookup: { accountId: number } | { phoneNumberId: string },
): Promise<boolean> {
  const account =
    'accountId' in lookup
      ? await db.whatsappAccount.findUnique({
          where: { id: lookup.accountId },
          select: { id: true, isDefault: true },
        })
      : await db.whatsappAccount.findFirst({
          where: { phoneNumberId: lookup.phoneNumberId },
          select: { id: true, isDefault: true },
        });
  if (!account || !isDedicatedPlatformAccount(account)) {
    return false;
  }
  const config = await db.tenantOutreachConfig.findUnique({
    where: { tenantId },
    select: { whatsappAccountId: true },
  });
  return config?.whatsappAccountId === account.id;
}

export type UpsertConversationMessageInput = {
  tenantId: number;
  phone: string;
  profileName: string | null;
  direction: WhatsappConversationDirection;
  wamid: string;
  type: string;
  body: string | null;
  raw: Prisma.InputJsonValue;
  listLeadId?: number | null;
  listSendId?: number | null;
};

export async function upsertConversationThenMessage(
  db: ConversationStore,
  input: UpsertConversationMessageInput,
): Promise<{
  conversationId: number;
  displayName: string;
  message: {
    id: number;
    wamid: string;
    type: string;
    body: string | null;
    phone: string;
    createdAt: Date;
  };
}> {
  const existing = await db.whatsappConversation.findUnique({
    where: {
      tenantId_phone: { tenantId: input.tenantId, phone: input.phone },
    },
    select: { id: true, displayName: true },
  });
  const displayName = resolveConversationDisplayName({
    profileName: input.profileName,
    phone: input.phone,
    existingDisplayName: existing?.displayName,
    isNewThread: existing == null,
  });
  const now = new Date();
  const inboundAt =
    input.direction === WhatsappConversationDirection.IN ? now : undefined;

  const conversation = await db.whatsappConversation.upsert({
    where: {
      tenantId_phone: { tenantId: input.tenantId, phone: input.phone },
    },
    create: {
      tenantId: input.tenantId,
      phone: input.phone,
      displayName,
      lastMessageAt: now,
      lastInboundAt: inboundAt ?? null,
    },
    update: {
      displayName,
      lastMessageAt: now,
      ...(inboundAt ? { lastInboundAt: inboundAt } : {}),
    },
  });

  const message = await db.whatsappConversationMessage.create({
    data: {
      wamid: input.wamid,
      direction: input.direction,
      type: input.type,
      body: input.body,
      raw: input.raw,
      phone: input.phone,
      tenantId: input.tenantId,
      conversationId: conversation.id,
      listLeadId: input.listLeadId ?? null,
      listSendId: input.listSendId ?? null,
    },
  });

  return {
    conversationId: conversation.id,
    displayName: conversation.displayName,
    message,
  };
}
