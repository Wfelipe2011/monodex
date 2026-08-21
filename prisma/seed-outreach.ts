/**
 * Idempotent seed: platform WhatsappAccount + stub templates + TenantOutreachConfig
 * + empty TenantSendPolicy + TenantTemplateGrant for stub templates on the operational tenant.
 *
 * Tenant resolution:
 * - Uses TENANT_ID env when set
 * - Otherwise defaults to id 8 (current notifly operational tenant)
 * - If that tenant does not exist, exits with instructions to set TENANT_ID
 *
 * WABA: WHATSAPP_WABA_ID env, or placeholder SET_WABA_ID (warn). Does not call Graph.
 * Does not delete WhatsappAccount.
 *
 * Usage: npx ts-node prisma/seed-outreach.ts
 */
import {
  PlatformJobKey,
  Prisma,
  PrismaClient,
  WhatsappProvider,
} from '@prisma/client';
import { parseTemplateSlots } from '../libs/shared/whatsapp-template-slots';

const PLATFORM_PHONE_NUMBER_ID = '1292251013966333';
const DEFAULT_OPERATIONAL_TENANT_ID = 8;
const PLACEHOLDER_WABA_ID = 'SET_WABA_ID';
const TEMPLATE_LANGUAGE = 'pt_BR';

const OUTREACH_TEMPLATE_NAME = 'test_gladson';
const NOTIFY_TEMPLATE_NAME = 'lembrete_entrar_contato_interessado';

const DEFAULT_SCHEDULES: Array<{
  jobKey: PlatformJobKey;
  cronExpression: string;
  timeZone: string;
  enabled: boolean;
}> = [
  {
    jobKey: PlatformJobKey.WHATSAPP_TEMPLATE_SYNC,
    cronExpression: '0 5 * * *',
    timeZone: 'America/Sao_Paulo',
    enabled: true,
  },
  {
    jobKey: PlatformJobKey.SCRAPE,
    cronExpression: '0 6 * * *',
    timeZone: 'America/Sao_Paulo',
    enabled: true,
  },
  {
    jobKey: PlatformJobKey.ORPHAN_MEDIA_CLEANUP,
    cronExpression: '0 3 1,16 * *',
    timeZone: 'America/Sao_Paulo',
    enabled: true,
  },
  {
    jobKey: PlatformJobKey.ON_DEMAND_SCHEDULE_RUN,
    cronExpression: '0 * * * *',
    timeZone: 'America/Sao_Paulo',
    enabled: true,
  },
];

const SCHEDULE = {
  2: [18],
  3: [18],
  4: [13, 18],
};

const CATEGORIES = [
  'contadores',
  'contabilidade',
  'cartórios',
  'despachantes',
  'consultórios',
  'clínicas',
];

const OUTREACH_COMPONENTS = [
  { type: 'HEADER', format: 'IMAGE' },
  {
    type: 'BODY',
    text: 'Olá, {{1}} — temos uma indicação para o seu negócio.',
  },
];

const NOTIFY_COMPONENTS = [
  {
    type: 'BODY',
    text: 'O lead {{customer_name}} ({{customer_phone}}) pediu contato. {{customer_lead}}',
    example: {
      body_text_named_params: [
        { param_name: 'customer_name', example: 'Maria' },
        { param_name: 'customer_phone', example: '11999999999' },
        { param_name: 'customer_lead', example: 'customer_lead' },
      ],
    },
  },
  {
    type: 'BUTTONS',
    buttons: [
      {
        type: 'URL',
        text: 'WhatsApp',
        url: 'https://wa.me/{{1}}',
      },
    ],
  },
];

const prisma = new PrismaClient();

function resolveWabaId(): string {
  const fromEnv = process.env.WHATSAPP_WABA_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  console.warn(
    `[seed-outreach] WHATSAPP_WABA_ID ausente; usando placeholder "${PLACEHOLDER_WABA_ID}". ` +
      `Não invente um WABA de produção — PATCH a conta depois do sync.`,
  );
  return PLACEHOLDER_WABA_ID;
}

function defaultSlotBindings(headerImageUrl: string | undefined) {
  const outreach: Record<string, { type: string; value?: string }> = {
    'body.1': {
      type: 'literal',
      value: 'Gladson Teixeira (contador em Pindamonhagaba)',
    },
  };
  if (headerImageUrl) {
    outreach['header.image'] = { type: 'header_image', value: headerImageUrl };
  } else {
    outreach['header.image'] = { type: 'header_image', value: '' };
  }
  return {
    outreach,
    notify: {
      'body.customer_name': { type: 'lead.name' },
      'body.customer_phone': { type: 'lead.phone' },
      'body.customer_lead': { type: 'literal', value: 'customer_lead' },
      'button.0.url': { type: 'lead.phone' },
    },
  };
}

async function upsertPlatformAccount() {
  const wabaId = resolveWabaId();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.whatsappAccount.findFirst({
      where: {
        tenantId: null,
        provider: WhatsappProvider.CLOUD_API,
        phoneNumberId: PLATFORM_PHONE_NUMBER_ID,
      },
    });

    await tx.whatsappAccount.updateMany({
      where: {
        isDefault: true,
        ...(existing ? { id: { not: existing.id } } : {}),
      },
      data: { isDefault: false },
    });

    if (existing) {
      const updated = await tx.whatsappAccount.update({
        where: { id: existing.id },
        data: {
          tokenEnvKey: 'WHATSAPP_TOKEN',
          enabled: true,
          wabaId,
          isDefault: true,
        },
      });
      console.log(
        `[seed-outreach] Platform WhatsappAccount updated id=${updated.id} isDefault=true`,
      );
      return updated;
    }

    const created = await tx.whatsappAccount.create({
      data: {
        provider: WhatsappProvider.CLOUD_API,
        phoneNumberId: PLATFORM_PHONE_NUMBER_ID,
        tokenEnvKey: 'WHATSAPP_TOKEN',
        wabaId,
        tenantId: null,
        enabled: true,
        isDefault: true,
      },
    });
    console.log(
      `[seed-outreach] Platform WhatsappAccount created id=${created.id} isDefault=true`,
    );
    return created;
  });
}

async function ensureDefaultSchedules() {
  for (const spec of DEFAULT_SCHEDULES) {
    const existing = await prisma.platformJobSchedule.findUnique({
      where: { jobKey: spec.jobKey },
    });
    if (existing) {
      console.log(
        `[seed-outreach] PlatformJobSchedule ${spec.jobKey} already exists cron="${existing.cronExpression}" (kept)`,
      );
      continue;
    }
    await prisma.platformJobSchedule.create({ data: spec });
    console.log(
      `[seed-outreach] PlatformJobSchedule ${spec.jobKey} created cron="${spec.cronExpression}"`,
    );
  }
}

async function ensureStubTemplate(
  whatsappAccountId: number,
  name: string,
  components: unknown[],
) {
  const existing = await prisma.whatsappMessageTemplate.findUnique({
    where: {
      whatsappAccountId_name_language: {
        whatsappAccountId,
        name,
        language: TEMPLATE_LANGUAGE,
      },
    },
  });
  if (existing) {
    console.log(
      `[seed-outreach] Template ${name}/${TEMPLATE_LANGUAGE} exists id=${existing.id}`,
    );
    return existing;
  }

  const byName = await prisma.whatsappMessageTemplate.findFirst({
    where: { whatsappAccountId, name },
  });
  if (byName) {
    console.log(
      `[seed-outreach] Template ${name} found by name id=${byName.id} lang=${byName.language}`,
    );
    return byName;
  }

  const slots = parseTemplateSlots(components);
  const created = await prisma.whatsappMessageTemplate.create({
    data: {
      whatsappAccountId,
      name,
      language: TEMPLATE_LANGUAGE,
      status: 'APPROVED',
      category: 'UTILITY',
      parameterFormat: name === OUTREACH_TEMPLATE_NAME ? 'POSITIONAL' : 'NAMED',
      components: components as Prisma.InputJsonValue,
      slots: slots as unknown as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
  });
  console.log(
    `[seed-outreach] Stub template ${name}/${TEMPLATE_LANGUAGE} created id=${created.id}`,
  );
  return created;
}

async function resolveOperationalTenantId(): Promise<number> {
  const fromEnv = process.env.TENANT_ID;
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `TENANT_ID inválido: "${fromEnv}". Informe um inteiro positivo.`,
      );
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: parsed } });
    if (!tenant) {
      throw new Error(
        `Tenant id=${parsed} (TENANT_ID) não encontrado. Cadastre o tenant ou ajuste TENANT_ID.`,
      );
    }
    return tenant.id;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: DEFAULT_OPERATIONAL_TENANT_ID },
  });
  if (!tenant) {
    throw new Error(
      `Tenant operacional padrão id=${DEFAULT_OPERATIONAL_TENANT_ID} não existe neste ambiente. ` +
        `Passe TENANT_ID=<id> ao executar o seed (ex.: TENANT_ID=4 npx ts-node prisma/seed-outreach.ts).`,
    );
  }
  return tenant.id;
}

async function ensureEmptySendPolicies() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    await prisma.tenantSendPolicy.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        allowedCityIds: [],
        deniedCityIds: [],
        respectAllTenants: false,
        exclusive: false,
      },
      update: {},
    });
  }
  console.log(
    `[seed-outreach] TenantSendPolicy empty defaults ensured for ${tenants.length} tenant(s)`,
  );
}

async function ensureTemplateGrants(tenantId: number, templateIds: number[]) {
  for (const templateId of templateIds) {
    const grant = await prisma.tenantTemplateGrant.upsert({
      where: {
        tenantId_templateId: { tenantId, templateId },
      },
      create: { tenantId, templateId },
      update: {},
    });
    console.log(
      `[seed-outreach] TenantTemplateGrant upserted id=${grant.id} tenantId=${tenantId} templateId=${templateId}`,
    );
  }
}

async function upsertOutreachConfig(
  tenantId: number,
  outreachTemplateId: number,
  notifyTemplateId: number,
) {
  const headerImageUrl = process.env.WHATSAPP_OUTREACH_HEADER_IMAGE_URL?.trim();
  const slotBindings = defaultSlotBindings(headerImageUrl);
  const existing = await prisma.tenantOutreachConfig.findUnique({
    where: { tenantId },
  });

  if (!existing) {
    const created = await prisma.tenantOutreachConfig.create({
      data: {
        tenantId,
        enabled: true,
        costPerLead: 0.35,
        costPerOnDemandSend: 0,
        cashbackOnReply: 0,
        coinDebitOnStatus: 'delivered',
        outreachTemplateId,
        notifyTemplateId,
        slotBindings: slotBindings as Prisma.InputJsonValue,
        schedule: SCHEDULE,
        categories: CATEGORIES,
        leadsPerRun: 5,
        sendIntervalSeconds: 5,
      },
    });
    console.log(
      `[seed-outreach] TenantOutreachConfig created id=${created.id} tenantId=${tenantId}`,
    );
    return created;
  }

  const updateData: Prisma.TenantOutreachConfigUpdateInput = {
    enabled: true,
    costPerLead: 0.35,
    cashbackOnReply: 0,
    schedule: SCHEDULE,
    categories: CATEGORIES,
  };
  if (existing.outreachTemplateId == null) {
    updateData.outreachTemplate = { connect: { id: outreachTemplateId } };
  }
  if (existing.notifyTemplateId == null) {
    updateData.notifyTemplate = { connect: { id: notifyTemplateId } };
  }

  const updated = await prisma.tenantOutreachConfig.update({
    where: { tenantId },
    data: updateData,
  });
  console.log(
    `[seed-outreach] TenantOutreachConfig updated id=${updated.id} tenantId=${tenantId} (slotBindings kept)`,
  );
  return updated;
}

async function main() {
  await ensureEmptySendPolicies();
  const account = await upsertPlatformAccount();
  await ensureDefaultSchedules();
  const outreachTemplate = await ensureStubTemplate(
    account.id,
    OUTREACH_TEMPLATE_NAME,
    OUTREACH_COMPONENTS,
  );
  const notifyTemplate = await ensureStubTemplate(
    account.id,
    NOTIFY_TEMPLATE_NAME,
    NOTIFY_COMPONENTS,
  );
  const tenantId = await resolveOperationalTenantId();
  await ensureTemplateGrants(tenantId, [
    outreachTemplate.id,
    notifyTemplate.id,
  ]);
  const config = await upsertOutreachConfig(
    tenantId,
    outreachTemplate.id,
    notifyTemplate.id,
  );

  console.log('[seed-outreach] Done.', {
    platformAccountId: account.id,
    phoneNumberId: account.phoneNumberId,
    isDefault: account.isDefault,
    wabaId: account.wabaId,
    outreachTemplateId: outreachTemplate.id,
    notifyTemplateId: notifyTemplate.id,
    outreachConfigId: config.id,
    tenantId: config.tenantId,
  });
}

main()
  .catch((err) => {
    console.error('[seed-outreach] Failed:', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
