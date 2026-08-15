# Task 3 — Notifly — parâmetro body do template

**Change:** `outreach-contact-text`
**Grupo:** 3 de 4
**Pré-requisitos:** [1](./task-01-schema-e-migration.md)
**Desbloqueia:** [4](./task-04-postman-seed-e-verificacao.md)

## Objetivo do grupo

O envio de outreach preenche `{{1}}` positional com `outreachContactText` e não chama a Meta se o texto estiver vazio.

## Contexto para o subagent

- Arquivo: `apps/notifly/src/leads.service.ts`, método `contactLeads`.
- Hoje monta `templateComponents` só com header image (`config.headerImageUrl` ou `WHATSAPP_OUTREACH_HEADER_IMAGE_URL`) e POST `type: 'template'` com `name: config.outreachTemplateName`, `language.code: 'pt_BR'`.
- O template `test_gladson` é `parameter_format: POSITIONAL` — **não** enviar `parameter_name` (isso é o notify tenant em `responseLeads`, named).
- `responseLeads` não entra nesta task.
- Mix premium, intervalo, coins, TenantLead permanecem iguais.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/leads.service.ts` | editar |

---

## 3.1 — Componente body

### O que fazer

Depois de resolver o header, se `config.outreachContactText?.trim()`:

```ts
templateComponents.push({
  type: 'body',
  parameters: [
    {
      type: 'text',
      text: config.outreachContactText.trim(),
    },
  ],
});
```

Manter o header como está. O POST já espalha `components` quando `templateComponents.length > 0`.

### Critérios de aceite

- [ ] Payload inclui body positional com o texto da config
- [ ] Não usa `parameter_name` no outreach
- [ ] Header image continua sendo enviado quando há URL

### Não fazer

- Não copiar o shape named de `responseLeads`
- Não ler env para o texto de contato

---

## 3.2 — Skip se vazio

### O que fazer

Antes do loop de envio (após montar `leadsToContact`, junto dos credenciais):

Se `!config.outreachContactText?.trim()`, log warn (`[contactLeads] outreachContactText ausente; pulando envios do tenant`) e `return` sem POST e sem criar `TenantLead` / debitar coins.

Não enviar header-only para a Meta nesse caso.

### Critérios de aceite

- [ ] Texto vazio → nenhum axios POST de template de outreach
- [ ] Texto preenchido → POST ocorre como hoje + body

### Não fazer

- Não desabilitar o tenant no banco
- Não usar um placeholder tipo `"o responsável"`

---

## Verificação do grupo

Leitura do POST em `contactLeads`: header + body quando texto existe; early return quando não.

## Handoff para próxima task

Runtime alinhado ao template novo. Seed/Postman no grupo 4.
