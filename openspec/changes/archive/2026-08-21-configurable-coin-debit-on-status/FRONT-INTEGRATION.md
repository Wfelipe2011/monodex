# Integração front — gatilho de débito de coins por status

Handoff para o PWA/Next (não vive neste repo). Use **este arquivo + Swagger** (`swagger-spec.json` ou `GET /api` no gym-ctrl).

| | |
|--|--|
| **Change** | `configurable-coin-debit-on-status` |
| **Breaking** | **Não.** Paths iguais. Campo **aditivo** `coinDebitOnStatus`. |
| **Auth** | Sem mudança: `POST /auth/login` → `{ "token": "<JWT>" }` |
| **Quem escreve** | Só `SUPER_ADMIN` (tags `Platform — *`) |
| **Quem lê** | `SUPER_ADMIN` e `ADMIN` do tenant (tags `Tenant — *`) |

---

## TL;DR — o que o front precisa fazer

1. Tipar `coinDebitOnStatus` no model de outreach config.
2. Na tela **Super Admin → outreach do cliente**, ao lado de preço/cashback, um **select** (`sent` / `delivered` / `read`) que salva via `PATCH /platform/tenants/:tenantId/outreach-config`.
3. Na tela **Admin do tenant → outreach**, **mostrar** o valor (somente leitura). **Nunca** enviar no PUT/PATCH tenant.
4. Não criar telas novas de envio, WS ou coins — só config.

---

## O que mudou no produto (contexto para copy)

| Antes | Agora |
|-------|--------|
| Coin debitado no Graph 200 (aceite Meta) | Coin debitado quando o **status do webhook** atinge o gatilho do tenant |
| Sem config de “quando cobrar” | Campo `coinDebitOnStatus` por tenant (default `delivered`) |
| `failed` já tinha cobrado o cliente | `failed` **não** fica cobrado (estorna se já debitou); cidade reabre telefone |

**Por quê default `delivered`?** A Meta (modelo per-message) só fatura template entregue. Alinhar o cliente à Meta.

Ordem Meta (sucesso): `sent` &lt; `delivered` &lt; `read`.  
Runtime: debita quando o status recebido tem rank **≥** gatilho (ex.: gatilho `delivered` + webhook só `read` → ainda debita 1×).

`failed` **nunca** é valor de config nem opção de UI.

---

## Como achar no Swagger

Arquivo: `swagger-spec.json` na raiz do monorepo (ou UI `/api` do gym-ctrl → Authorize com Bearer).

### Tags

| Tag | Uso no front |
|-----|----------------|
| **Platform — Outreach Config** | Super Admin: GET + PATCH (escreve gatilho) |
| **Tenant — Outreach Config** | Admin: GET (lê gatilho); PUT/PATCH **sem** o campo |

### Paths (sem path novo)

| Método | Path | Schema request (Swagger) |
|--------|------|---------------------------|
| GET | `/platform/tenants/{tenantId}/outreach-config` | — (response tipado como `object`; shape real abaixo) |
| PATCH | `/platform/tenants/{tenantId}/outreach-config` | `PatchPlatformOutreachConfigDto` |
| GET | `/tenant/{tenantId}/outreach-config` | — (mesmo shape de GET) |
| PUT/PATCH | `/tenant/{tenantId}/outreach-config` | `UpsertTenantOutreachConfigDto` / `PatchOutreachConfigDto` — **sem** `coinDebitOnStatus` |

### Schema a abrir no Swagger UI

1. **Components → Schemas → `PatchPlatformOutreachConfigDto`**
2. Propriedade nova:

```json
"coinDebitOnStatus": {
  "type": "string",
  "description": "Status Meta em que o coin é debitado (cidade e lista). Default no schema: delivered. failed não é permitido.",
  "enum": ["sent", "delivered", "read"],
  "example": "delivered"
}
```

3. No path PATCH platform, o `summary` agora diz explicitamente: *“Patch de preço, gatilho de débito e número WhatsApp…”*.

> **Atenção:** o GET documenta response como `type: object` genérico (já era assim). **Não** confie só no schema de response — use o shape deste documento / Postman.

---

## Tipos TypeScript (copiar)

```ts
/** Gatilho de débito — alinhado ao enum Prisma / Swagger */
export type CoinDebitOnStatus = 'sent' | 'delivered' | 'read';

export const COIN_DEBIT_ON_STATUS_OPTIONS: {
  value: CoinDebitOnStatus;
  label: string;
  hint: string;
}[] = [
  {
    value: 'sent',
    label: 'Enviado (sent)',
    hint: 'Debita assim que a Meta confirma envio ao servidor. Pode estornar se depois falhar.',
  },
  {
    value: 'delivered',
    label: 'Entregue (delivered)',
    hint: 'Recomendado — alinhado à cobrança Meta de template.',
  },
  {
    value: 'read',
    label: 'Lido (read)',
    hint: 'Só debita quando o destinatário abre a mensagem.',
  },
];

/** Campos platform-owned no PATCH (podem ir juntos) */
export type PatchPlatformOutreachConfigBody = {
  costPerLead?: number;
  cashbackOnReply?: number;
  coinDebitOnStatus?: CoinDebitOnStatus;
  whatsappAccountId?: number | null;
};

/** Trecho do GET outreach-config (campos relevantes) */
export type OutreachConfigResponse = {
  id: number;
  tenantId: number;
  enabled: boolean;
  costPerLead: number;
  cashbackOnReply: number;
  coinDebitOnStatus: CoinDebitOnStatus; // sempre presente após migrate; default delivered
  whatsappAccountId: number | null;
  // ... demais campos já existentes (templates, schedule, etc.)
};
```

**Não tipar** `failed` em `CoinDebitOnStatus`.

---

## Implementação por tela

### A) Super Admin — editar outreach do tenant

**Onde:** mesma tela/seção onde já editam `costPerLead` / `cashbackOnReply` / número WhatsApp.

**Fluxo**

```
GET /platform/tenants/:tenantId/outreach-config
        ↓
preencher form (preço + select gatilho + …)
        ↓
PATCH /platform/tenants/:tenantId/outreach-config
  { "coinDebitOnStatus": "delivered" }   // ou junto com costPerLead
        ↓
200 → row completa (usar response para atualizar form)
```

**UI sugerida**

| Elemento | Valor |
|----------|--------|
| Label | “Debitar coins quando” ou “Gatilho de cobrança” |
| Controle | `<select>` / radio com as 3 opções |
| Default ao abrir | valor do GET; se ausente (legado raro) → `delivered` |
| Helper text | “Padrão: entregue — igual à Meta. Falha de entrega não cobra o cliente.” |
| Salvar | mesmo botão do bloco de preço (um PATCH) |

**Exemplo PATCH só gatilho**

```http
PATCH /platform/tenants/4/outreach-config
Authorization: Bearer <JWT_SUPER_ADMIN>
Content-Type: application/json

{ "coinDebitOnStatus": "sent" }
```

**Exemplo PATCH combinado**

```json
{
  "costPerLead": 0.35,
  "cashbackOnReply": 0,
  "coinDebitOnStatus": "delivered"
}
```

**Erros a tratar**

| Status | Quando | UI |
|--------|--------|-----|
| 400 | `coinDebitOnStatus: "failed"` ou valor inválido | Toast: valor inválido; não oferecer `failed` no select |
| 403 | body com campos tenant-owned (`enabled`, `schedule`, …) no PATCH platform | Não misturar formulários; só enviar platform-owned |
| 404 | config ainda não existe | Criar via PUT bootstrap / fluxo já existente, depois PATCH |

---

### B) Admin do tenant — outreach (somente leitura do gatilho)

**Onde:** tela de config de outreach do cliente.

**Fluxo**

```
GET /tenant/:tenantId/outreach-config
        ↓
exibir coinDebitOnStatus como badge/texto
        ↓
PUT/PATCH tenant → NÃO incluir coinDebitOnStatus
```

**UI sugerida**

| Elemento | Valor |
|----------|--------|
| Label | “Cobrança de coins” |
| Exibição | “Entregue (delivered)” / mapear labels acima |
| Interação | sem select editável |
| Hint | “Definido pela plataforma. Em caso de falha de entrega, o valor não é cobrado.” |

**Se o front enviar por engano**

```http
PATCH /tenant/4/outreach-config
{ "coinDebitOnStatus": "sent" }
```

→ **403** (`PLATFORM_OUTREACH_KEYS` inclui `coinDebitOnStatus`). Tratar como os outros campos platform-owned (`costPerLead`, etc.).

---

## Shape GET (response real)

Os dois GETs (platform e tenant) devolvem a mesma row. Trecho relevante:

```json
{
  "id": 10,
  "tenantId": 4,
  "enabled": true,
  "costPerLead": 0.35,
  "cashbackOnReply": 0,
  "coinDebitOnStatus": "delivered",
  "whatsappAccountId": null,
  "outreachTemplateId": 1,
  "notifyTemplateId": 2,
  "slotBindings": {},
  "schedule": { "2": [18] },
  "categories": ["contadores"],
  "leadsPerRun": 5,
  "sendIntervalSeconds": 5,
  "resolvedWhatsappAccount": {
    "id": 1,
    "phoneNumberId": "1292251013966333",
    "displayPhone": null,
    "isDefault": true
  }
}
```

`coinDebitOnStatus` vem **sempre** após a migration (default DB `delivered`).

---

## O que NÃO muda no front

| Superfície | Ação |
|------------|------|
| Inbox / WebSocket / push | Nenhuma |
| `GET .../outreach/sends` (cidade) | Continua polling de status; **não** mostra “foi debitado?” nesta change |
| `GET .../lead-lists/:id/sends` (lista) | Idem |
| Extrato de coins | Continua listando `DEBITO`/`CREDITO`; descriptions no backend passam a citar `wamid` — opcional exibir |
| Login / JWT / roles | Iguais |
| Paths novos | Nenhum |

Saldo na home pode oscilar depois do webhook (débito atrasado vs Graph). Se a UI mostra “saldo disponível para envio”, o backend já reserva pending — o número do GET de coins continua sendo o saldo **real**; não inventar “saldo reservado” no front nesta change.

---

## Checklist de implementação (front)

- [ ] Tipo `CoinDebitOnStatus` + union sem `failed`
- [ ] Model/DTO de outreach inclui `coinDebitOnStatus`
- [ ] Super Admin: select nas 3 opções, mesmo bloco de preço
- [ ] Super Admin: PATCH platform persiste e reflete no form
- [ ] Admin tenant: campo visível read-only
- [ ] Admin tenant: body de PUT/PATCH **não** contém `coinDebitOnStatus` / `costPerLead` / `cashbackOnReply` / `whatsappAccountId`
- [ ] Tratamento 400 (enum inválido) e 403 (campo platform no path tenant)
- [ ] Copy default menciona “entregue / alinhado à Meta”
- [ ] Smoke: GET platform → PATCH `read` → GET → valor `read`; GET tenant mostra `read` sem select

---

## Postman

Collection: `postman/monodex.postman_collection.json`  
Requests de outreach config platform já incluem exemplos com `coinDebitOnStatus`.

---

## Backend / ops (não bloqueia o PWA)

Backfill legado e checklist E2E de webhook: [NOTES.md](./NOTES.md).

```bash
npm run backfill:coin-debit-on-status -- --dry-run
```

O front **não** precisa chamar o backfill.
