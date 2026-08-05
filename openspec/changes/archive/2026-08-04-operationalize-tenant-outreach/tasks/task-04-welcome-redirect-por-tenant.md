# Task 4 — Welcome redirect por Tenant

**Change:** `operationalize-tenant-outreach`
**Grupo:** 4 de 5
**Pré-requisitos:** [1](./task-01-schema-e-migration.md) (só precisa Tenant.uuid/phone já existentes; seed phone recomendado)
**Desbloqueia:** [5](./task-05-verificacao-e-handoff.md)

## Objetivo do grupo

Eliminar o mapa hardcoded UUID→telefone do welcome e resolver redirect via banco (`Tenant.uuid` / `Tenant.phone`).

## Contexto para o subagent

- Arquivo: `apps/notifly/src/WhatsappController.ts`
- Rota: `GET /sites/welcome/:uuid`
- Hoje:
  - Constante `tenats` com dois UUIDs → números
  - Sanitiza `uuid.replace('{{1}}', '')`
  - Se hit: redirect `https://wa.me/+${phone}?text=Olá, gostaria de saber mais sobre os serviços!`
  - Senão: `res.sendFile(join(process.cwd(), 'public', 'index.html'))`
- Controller **não** injeta Prisma ainda; `NotiflyModule` já importa `PrismaModule`.
- Spec: `specs/tenant-welcome-redirect/spec.md`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/WhatsappController.ts` | editar |

---

## 4.1 — Lookup por UUID no Prisma

### O que fazer

1. Injetar `PrismaService` no constructor do `WhatsappController`.
2. Sanitizar param removendo `{{1}}` (manter comportamento).
3. `prisma.tenant.findUnique({ where: { uuid: sanitized } })` (ou `findFirst`).

Controller precisa virar injectable com deps — padrão Nest já suportado.

### Critérios de aceite

- [ ] UUID resolvido via query Prisma
- [ ] Placeholder `{{1}}` continua sanitizado

### Não fazer

- Não criar nova rota; manter `/sites/welcome/:uuid`

---

## 4.2 — Redirect e fallback

### O que fazer

- Se tenant encontrado **e** `phone` com dígitos: limpar não-dígitos; validar `/^[0-9]+$/`; redirect wa.me com o mesmo texto atual.
- Caso contrário (não encontrado / sem phone / inválido): servir `public/index.html` como hoje.
- Preferir `BadRequestException` apenas se phone presente porém inválido após clean — alinhar ao comportamento atual do branch “hit”.

### Critérios de aceite

- [ ] Tenant com phone válido redireciona para wa.me correto
- [ ] UUID desconhecido ou sem phone cai no HTML estático

### Não fazer

- Não alterar `public/index.html` visualmente

---

## 4.3 — Remover mapa `tenats`

### O que fazer

Apagar a constante `tenats` e qualquer referência. Garantir que os UUIDs que estavam no mapa existam no DB com `phone` correspondente no ambiente real (operação/data), não no código.

### Critérios de aceite

- [ ] `rg "tenats" apps/notifly` vazio
- [ ] Nenhum mapa UUID→phone em memória no controller

### Não fazer

- Não copiar os telefones do mapa antigo para o código-fonte em outro lugar

---

## Verificação do grupo

```text
GET /sites/welcome/<tenant.uuid>     → 302 wa.me
GET /sites/welcome/{{1}}<uuid>       → 302 wa.me (mesmo tenant)
GET /sites/welcome/nao-existe        → 200 index.html
```

## Handoff para próxima task

Welcome desalinhado do hardcode. Task 5 valida junto com outreach E2E e anota Baileys como fora de escopo.
