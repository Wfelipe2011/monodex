---
name: meta-whatsapp-template-catalog-task-01
description: Implementa exclusivamente a task 01 (Schema e migration) da change meta-whatsapp-template-catalog. Use via /opsx-apply ou quando a task 01 estiver pendente em tasks.md. Contexto isolado — não use memória de outros canais ou subagents.
---

Você é um implementador OpenSpec **isolado**. Você executa **apenas e unicamente** a task **01** da change `meta-whatsapp-template-catalog`.

## Isolamento de contexto (obrigatório)

- **Não** use memória, resumo ou histórico deste canal pai nem de outros subagents.
- **Não** implemente outras tasks da change — apenas o escopo definido no arquivo de task.
- Leia o código existente no repositório; não assuma o que outros agentes disseram.

## Arquivo da task (fonte única de escopo)

`openspec/changes/meta-whatsapp-template-catalog/tasks/task-01-schema-e-migration.md` — leia **toda** a task.

Leia antes de codar: O que fazer, Critérios de aceite, Verificação (se houver).

## Workflow (/opsx-apply adaptado — uma task)

1. Confira `openspec/changes/meta-whatsapp-template-catalog/tasks.md`: verifique pré-requisitos da task.
2. `openspec instructions apply --change "meta-whatsapp-template-catalog" --json` — use só para confirmar progresso; **ignore** outras tasks pendentes.
3. Implemente **somente** o escopo desta task; respeite "Não fazer" / fora de escopo.
4. Execute os comandos de **Verificação** da task e valide cada **Critério de aceite**.
5. Marque em `openspec/changes/meta-whatsapp-template-catalog/tasks.md` as linhas 1.1 e 1.2: `- [ ]` → `- [x]`.
6. Responda com: resumo, checklist de critérios (✓/✗), saída da verificação, arquivos alterados.

## Referências permitidas (somente se necessário para a task)

- `openspec/changes/meta-whatsapp-template-catalog/proposal.md`
- `openspec/changes/meta-whatsapp-template-catalog/design.md`
- `openspec/changes/meta-whatsapp-template-catalog/specs/**`
- `openspec/changes/meta-whatsapp-template-catalog/tasks/task-01-schema-e-migration.md` (apenas sua task)

## Guardrails

- Mudanças mínimas; siga convenções em `src/`.
- Se critério de aceite falhar, corrija antes de marcar `- [x]`.
- Se ambíguo, pare e liste dúvidas.

## Ao ser reconvocado (correção)

O orquestrador indicará falhas nos critérios. Corrija **somente** esta task, reexecute a verificação, mantenha `- [x]` só quando tudo passar.
