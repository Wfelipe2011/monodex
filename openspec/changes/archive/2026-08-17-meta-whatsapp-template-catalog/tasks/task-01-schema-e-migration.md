# Task 1 — Schema e migration

**Change:** `meta-whatsapp-template-catalog`
**Grupo:** 1 de 8
**Pré-requisitos:** nenhum
**Desbloqueia:** grupos 2–8

## Objetivo do grupo

Prisma passa a ter WABA na conta, catálogo de templates, bindings na outreach config (sem colunas flat) e schedules de job.

## Contexto para o subagent

- Schema: `prisma/schema.prisma`
- Models atuais: `WhatsappAccount` (~273), `TenantOutreachConfig` (~288) com `outreachTemplateName`, `notifyTenantTemplateName`, `headerImageUrl`, `outreachContactText`
- Token Meta **nunca** vira coluna
- Convenção: `@map` snake_case, `@@map` plural snake
- Não alterar lógica Nest nesta task além do que o client Prisma exigir para o repo compilar (se quebrar compile, deixe tipos temporários só se inevitável — preferir só schema+migration; grupos seguintes adaptam o código)

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_*/migration.sql` | criar via `npx prisma migrate dev` |

---

## 1.1 — Conta, catálogo e outreach config

### O que fazer

Em `WhatsappAccount` adicionar:

- `wabaId String @map("waba_id")`
- relação `templates WhatsappMessageTemplate[]`

Novo model:

```prisma
model WhatsappMessageTemplate {
  id                 Int              @id @default(autoincrement())
  whatsappAccountId  Int              @map("whatsapp_account_id")
  whatsappAccount    WhatsappAccount  @relation(fields: [whatsappAccountId], references: [id])
  metaId             String?          @map("meta_id")
  name               String
  language           String
  status             String
  category           String?
  parameterFormat    String?          @map("parameter_format")
  components         Json
  slots              Json
  lastSyncedAt       DateTime         @map("last_synced_at")
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")
  outreachConfigs    TenantOutreachConfig[] @relation("OutreachTemplate")
  notifyConfigs      TenantOutreachConfig[] @relation("NotifyTemplate")

  @@unique([whatsappAccountId, name, language])
  @@map("whatsapp_message_templates")
}
```

Em `TenantOutreachConfig`:

- **Remover** `outreachTemplateName`, `notifyTenantTemplateName`, `headerImageUrl`, `outreachContactText`
- Adicionar:
  - `outreachTemplateId Int? @map("outreach_template_id")`
  - `notifyTemplateId Int? @map("notify_template_id")`
  - `outreachTemplate WhatsappMessageTemplate? @relation("OutreachTemplate", fields: [outreachTemplateId], references: [id])`
  - `notifyTemplate WhatsappMessageTemplate? @relation("NotifyTemplate", fields: [notifyTemplateId], references: [id])`
  - `slotBindings Json @map("slot_bindings")`

FKs nullable para permitir create `enabled=false` incompleto; `slotBindings` NOT NULL com default `'{}'` na migration para rows existentes.

Migration SQL: `wabaId` NOT NULL — usar `DEFAULT ''` nas rows atuais e dropar default depois, ou preencher de `WHATSAPP_WABA_ID` se a migration permitir. Documentar no SQL.

### Critérios de aceite

- [ ] `npx prisma validate` passa
- [ ] Colunas removidas não existem no schema
- [ ] Unique `(whatsappAccountId, name, language)` declarado

### Não fazer

- Não chamar Graph
- Não editar DTOs Nest (grupo 3/5)

---

## 1.2 — Platform job schedule

### O que fazer

```prisma
enum PlatformJobKey {
  WHATSAPP_TEMPLATE_SYNC
  SCRAPE
}

model PlatformJobSchedule {
  id             Int            @id @default(autoincrement())
  jobKey         PlatformJobKey @unique @map("job_key")
  cronExpression String         @map("cron_expression")
  timeZone       String         @default("America/Sao_Paulo") @map("time_zone")
  enabled        Boolean        @default(true)
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")

  @@map("platform_job_schedules")
}
```

Na migration, `INSERT` as duas rows default:

- `WHATSAPP_TEMPLATE_SYNC` → `0 5 * * *`, `America/Sao_Paulo`, true
- `SCRAPE` → `0 6 * * *`, `America/Sao_Paulo`, true

Rodar `npx prisma migrate dev --name meta-whatsapp-template-catalog` (gerar client).

### Critérios de aceite

- [ ] Enum e model no schema
- [ ] Migration insere os dois defaults
- [ ] Client Prisma gerado inclui os novos types

### Não fazer

- Não registrar cron Nest aqui

---

## Verificação do grupo

`npx prisma validate` e arquivo de migration presente.

## Handoff para próxima task

Schema pronto. Grupo 2 pode escrever parsers sem Prisma. Grupos 3/5/7 passam a quebrar compile até adaptarem — execute-os depois desta migration.
