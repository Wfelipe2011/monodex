# Task 2 — Admin — outreachContactText

**Change:** `outreach-contact-text`
**Grupo:** 2 de 4
**Pré-requisitos:** [1](./task-01-schema-e-migration.md)
**Desbloqueia:** [4](./task-04-postman-seed-e-verificacao.md)

## Objetivo do grupo

Super-admin lê e grava `outreachContactText` com limite 80, sem newline, obrigatório no PUT e no enable.

## Contexto para o subagent

- DTOs: `apps/gym-ctrl/src/modules/admin/dto/upsert-outreach-config.dto.ts` e `patch-outreach-config.dto.ts` (class-validator + Swagger).
- Service: `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` — `upsert`/`patch`/`assertEnableAllowed`.
- Controller: `apps/gym-ctrl/src/modules/admin/outreach-config.controller.ts` — atualizar `@ApiOperation` descriptions.
- `ValidationPipe({ whitelist: true, transform: true })` no controller.
- PUT hoje: `outreachTemplateName` required com `@MinLength(1)`; knobs `leadsPerRun` opcionais.
- `assertEnableAllowed` já exige phone, active, costPerLead > 0, nomes de template.
- GET devolve o model Prisma completo — o campo aparece sozinho após o schema; não precisa de mapper.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/dto/upsert-outreach-config.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/dto/patch-outreach-config.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/outreach-config.controller.ts` | editar (descrições) |

---

## 2.1 — DTOs

### O que fazer

PUT (`UpsertOutreachConfigDto`): campo **required**

```ts
@ApiProperty({
  description: 'Texto positional {{1}} do body do template de outreach (quem entra em contato)',
  example: 'Gladson Teixeira (contador em Pindamonhagaba)',
  maxLength: 80,
})
@IsString()
@MinLength(1)
@MaxLength(80)
@Matches(/^[^\r\n\t]+$/)
outreachContactText: string;
```

PATCH: `@ApiPropertyOptional` + `@IsOptional()` com as mesmas regras quando enviado. Importar `MaxLength` e `Matches`.

### Critérios de aceite

- [ ] PUT sem o campo → 400
- [ ] string > 80 → 400
- [ ] string com `\n` → 400
- [ ] PATCH omitindo o campo é válido

### Não fazer

- Não tornar o campo opcional no PUT
- Não aceitar `null` para “apagar” o texto

---

## 2.2 — Service e enable

### O que fazer

- `upsert` create/update: persistir `outreachContactText: dto.outreachContactText.trim()`.
- `patch`: se `dto.outreachContactText !== undefined`, persistir trimado; incluir no `merged` para o enable check.
- `assertEnableAllowed`: se `enabled`, exigir `fields.outreachContactText?.trim()`; senão 400 `'Não é possível habilitar outreach: outreachContactText obrigatório'`.
- Estender a tipagem de `fields` com `outreachContactText: string`.

### Critérios de aceite

- [ ] GET após PUT mostra o texto trimado
- [ ] `enabled: true` com texto `''` no merge → 400
- [ ] PATCH só `{ enabled: true }` funciona se o texto já estiver gravado e não vazio

### Não fazer

- Não exigir o texto quando `enabled` é false
- Não gravar fallback de env

---

## Verificação do grupo

PUT válido + GET; PUT sem campo 400; enable sem texto 400.

## Handoff para próxima task

Contrato admin pronto para Postman. Runtime Notifly é grupo 3 (independente deste, após schema).
