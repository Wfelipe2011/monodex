## Context

O template Meta `test_gladson` (format POSITIONAL) agora tem HEADER IMAGE + BODY com `{{1}}` (“quem entra em contato”). `LeadsService.contactLeads` monta só o componente `header` (`headerImageUrl` ou env). Sem o body, a Graph API rejeita o envio.

`TenantOutreachConfig` já é a fonte de knobs por tenant (templates, lote, imagem, intervalo). O texto do contato é copy comercial fixa por tenant — exemplo: `Gladson Teixeira (contador em Pindamonhagaba)`.

## Goals / Non-Goals

**Goals:**

- Persistir um texto livre por tenant para `{{1}}`.
- Validar tamanho e conteúdo (sem quebra de linha) na API admin.
- Exigir o texto para `enabled=true`.
- Injetar o parâmetro positional no send de outreach.

**Non-Goals:**

- Rotação / fila de pessoas de contato.
- Montar o texto a partir de nome/cargo/cidade estruturados.
- Fallback de env para o texto (diferente do header image).
- Alterar o template de notify ao tenant (named params).
- Aprovar o template na Meta (operacional; status `PENDING` fica fora do código).
- UI web; só API + Postman + seed.

## Decisions

### D1 — Campo `outreachContactText`

**Escolha:** `String` obrigatório no Prisma (`@map("outreach_contact_text")`). Uma string por tenant, sem array.

**Por quê:** O produto pediu texto livre fixo. Array implicaria rotação, que está fora de escopo.

**Alternativa rejeitada:** JSON de “speakers” ou campos `contactName` + `contactRole` — overfit para um único `{{1}}`.

### D2 — Limite 80 caracteres, 1–80 após trim

**Escolha:** `@MinLength(1)` `@MaxLength(80)` no DTO. Persistido já trimado. Rejeitar se contiver `\n`, `\r` ou `\t` (variáveis de template Meta não aceitam newline).

**Por quê:** O exemplo cabe (~48). 80 cobre nome + (profissão em cidade) sem virar parágrafo. Meta aceita mais; o limite é de produto para não estourar o body visualmente.

**PUT:** campo required. **PATCH:** se enviado, mesmas regras; omitir preserva o valor.

### D3 — Obrigatório no enable, sem fallback de plataforma

**Escolha:** `assertEnableAllowed` falha se `outreachContactText` trim vazio, no mesmo bloco de `outreachTemplateName`. Runtime: se vazio (rows migradas), **não** POST na Graph API; log warn e pular o lead/tenant daquele send.

**Por quê:** Texto errado de outro tenant (ou um env global) é pior que não enviar.

**Migration:** `NOT NULL DEFAULT ''` para não quebrar rows; default do Prisma em creates novos pode ser omitido — a API PUT sempre envia o campo.

### D4 — Payload Cloud API: POSITIONAL body

**Escolha:** Além do header existente, sempre que houver texto:

```json
{
  "type": "body",
  "parameters": [{ "type": "text", "text": "<outreachContactText>" }]
}
```

Sem `parameter_name` (o template é POSITIONAL, não NAMED).

Header continua opcional com fallback de env. Body não é opcional para este template; se o texto faltar, não envia (D3).

### D5 — Seed

No `create` do `prisma/seed-outreach.ts`, gravar um exemplo operacional (`Gladson Teixeira (contador em Pindamonhagaba)` ou `SEED_OUTREACH_CONTACT_TEXT`). No `update`, **não** sobrescrever `outreachContactText` se a row já existir (mesmo padrão dos knobs de lote).

## Risks / Trade-offs

- [Template ainda PENDING] → envio falha até APPROVED; código pode ir na frente.
- [Tenants enabled com `''` após migrate] → runtime skip até PATCH; documentar no handoff.
- [Outro template sem `{{1}}`] → Meta pode rejeitar parâmetro extra. Mitigação: esta change assume o template de outreach atual com um body param; não há registry de schema por `outreachTemplateName`.
- [PUT breaking para clientes Postman] → atualizar collection na mesma change.

## Migration Plan

1. Migration Prisma da coluna.
2. Deploy gym-ctrl + notifly juntos (admin grava, runtime lê).
3. PATCH de `outreachContactText` em cada tenant enabled **antes** de apontar `outreachTemplateName` para o template novo aprovado.
4. Rollback: drop column + revert send para só header (o template novo continua exigindo `{{1}}` — rollback de código sem rollback de template Meta não restaura envios).

## Open Questions

- Nenhum bloqueante. Limite 80 pode subir depois via DTO sem mudar o significado do campo.
