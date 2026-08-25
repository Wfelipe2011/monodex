## Why

O catálogo já sincroniza o JSON completo de `components` da Meta, mas o endpoint do tenant omite esse payload — o front não consegue montar preview com textos, botões e placeholders (`{{1}}`) preenchíveis. Em paralelo, super-admins precisam gerenciar o ciclo de vida de templates de marketing e o perfil do número Cloud API já cadastrado (`phoneNumberId`), sem sair do painel.

## What Changes

- Expor o conteúdo completo do template (incluindo `components` com HEADER/BODY/FOOTER/BUTTONS e textos com `{{n}}`) nas listagens **tenant** (foco) e **platform**, em formato amigável ao front para preview local (substituição de variáveis no cliente).
- Incluir GET por id onde faltar, com o mesmo contrato de preview.
- **SUPER_ADMIN only:** CRUD de message templates na WABA da plataforma via Graph (criar marketing com variáveis, botões e header IMAGE; editar; apagar), com upsert no catálogo local e sync/status.
- Upload de mídia de exemplo (header IMAGE) necessário à criação/edição na Meta (Resumable Upload / handle).
- **SUPER_ADMIN:** ler e atualizar o WhatsApp Business Profile do número já existente (`about`, `description`, `address`, `email`, `websites`, `vertical`, foto de perfil) por conta plataforma.
- **Fora de escopo:** cadastrar/verificar/registrar telefone novo na Meta; Embedded Signup; display name approval flow completo (pode ser follow-up).

## Capabilities

### New Capabilities

- `whatsapp-template-preview`: contrato de resposta (list/get) com `components` + `slots` + metadados para o front renderizar preview e substituir placeholders.
- `whatsapp-template-lifecycle`: create / update / delete de templates MARKETING na WABA via Graph, restrito a `SUPER_ADMIN`, reconciliado com o catálogo local.
- `whatsapp-phone-business-profile`: GET/PATCH do business profile Meta para um `WhatsappAccount` de plataforma já existente.

### Modified Capabilities

- `whatsapp-template-catalog`: listagens de plataforma passam a garantir `components` no contrato; sync permanece fonte da verdade após writes.
- `tenant-template-grants`: `GET /tenant/:tenantId/whatsapp-templates` (e get-by-id se introduzido) passa a incluir payload de preview (`components` + campos auxiliares), sem sync Graph.
- `admin-platform-config` / `platform-whatsapp-cloud`: rotas de perfil do número sob contas WhatsApp de plataforma; sem provisionamento de número novo.

## Impact

- gym-ctrl: `WhatsappTemplatesController` / service (CRUD + response shape); `TenantTemplatesController` / `TemplateGrantsService` (expor components); `WhatsappAccountsController` (profile GET/PATCH); DTOs Swagger/Postman/FRONT-INTEGRATION.
- shared: possível helper de normalização de `components` para preview (sem obrigar render no servidor).
- notifly: sync existente reutilizado após create/edit/delete; sem mudança de envio obrigatória.
- Prisma: opcional cache de profile fields em `WhatsappAccount` (decisão no design); template row já tem `components`.
- Meta Graph: `whatsapp_business_management`; profile + message_templates write; Resumable Upload para header/foto.
- Permissões: mutations de template e profile apenas `SUPER_ADMIN`; tenant continua read-only nos templates granted.
