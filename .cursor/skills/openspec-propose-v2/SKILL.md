---
name: openspec-propose-v2
description: Propose a new OpenSpec change with all artifacts generated in one step AND task files enriched with implementation details per group. Use when the user invokes /opsx-propose-v2, wants to build a complete change proposal, or needs tasks ready for subagents to execute autonomously.
license: MIT
compatibility: Requires openspec CLI.
---

Extensão de `openspec-propose` com enriquecimento automático de tasks.

Faz tudo que `openspec-propose` faz e adiciona um passo final: para cada grupo numerado em `tasks.md`, cria um arquivo dedicado em `tasks/task-NN-<slug>.md` com instruções completas para subagents, e atualiza `tasks.md` com links para esses arquivos.

---

## Passos 1–5: idênticos ao openspec-propose

Execute exatamente os mesmos passos do `openspec-propose` original:

1. Se sem input, perguntar o que o usuário quer construir.
2. `openspec new change "<name>"`.
3. `openspec status --change "<name>" --json` → obter `applyRequires`.
4. Criar artefatos em sequência (`proposal.md`, `design.md`, `specs/`, `tasks.md`) usando `openspec instructions`.
5. `openspec status --change "<name>"` para mostrar progresso.

Não prosseguir para o passo 6 até que **todos** os artefatos em `applyRequires` estejam `done`.

---

## Passo 6: Enriquecer tasks (diferencial desta skill)

Após `tasks.md` estar criado e completo, executar o enriquecimento automático.

### 6a. Parsear grupos de tasks.md

Ler `openspec/changes/<name>/tasks.md`. Identificar cada grupo numerado:

```
## 1. Nome do Grupo
## 2. Outro Grupo
...
```

Cada `## N. Título` é um grupo. Cada linha `- [ ] N.M descrição` dentro do grupo é uma subtask.

### 6b. Criar um arquivo por grupo

Para cada grupo `N`, criar `openspec/changes/<name>/tasks/task-NN-<slug>.md` onde:
- `NN` é o número com zero à esquerda (01, 02, ...).
- `<slug>` é o título do grupo em kebab-case.

Exemplo: `## 2. OpenAPI — paths e schemas REST` → `tasks/task-02-openapi-paths-and-schemas.md`.

Cada arquivo **deve conter**:

```markdown
# Task N — <Título do Grupo>

**Change:** `<name>`
**Grupo:** N de <total>
**Pré-requisitos:** <grupos cujas tarefas este grupo depende, com links relativos>
**Desbloqueia:** <grupos que dependem deste>

## Objetivo do grupo

<1–2 frases: o que é entregue ao final deste grupo>

## Contexto para o subagent

<Fatos críticos do codebase que o subagent precisa saber:
  - Arquivos relevantes (paths exatos)
  - Comportamentos do runtime (Bun, Node, etc.)
  - Convenções do projeto (naming, snake_case, etc.)
  - O que NÃO alterar>

## Arquivos esperados ao concluir

| Arquivo | Ação (criar / editar / deletar) |
|---------|----------------------------------|
| ...     | ...                              |

---

## N.M — <Título da subtask>

### O que fazer

<Instruções específicas com detalhes suficientes para execução sem contexto adicional.
  Incluir: schemas, exemplos JSON/YAML, referências a handlers/funções reais do codebase,
  comandos shell quando aplicável.>

### Critérios de aceite

- [ ] <verificação objetiva>
- [ ] <verificação objetiva>

### Não fazer

- <guardrail explícito>

---

<repetir seção N.M para cada subtask do grupo>

---

## Verificação do grupo

<Como confirmar que o grupo está completo (testes, curl, checklist)>

## Handoff para próxima task

<O que o próximo subagent vai encontrar / assumir como pronto>
```

**Fontes de conteúdo para enriquecer:**
- `design.md`: decisões técnicas, riscos, estrutura de módulos.
- `specs/<capability>/spec.md`: requisitos e cenários.
- `proposal.md`: escopo, impacto.
- Código real do repositório: ler arquivos relevantes mencionados no design.

**Regra de detalhe:** cada subtask deve ser auto-contida o suficiente para um subagent executá-la recebendo apenas o arquivo de task como contexto.

### 6c. Atualizar tasks.md com links e índice

Reescrever `tasks.md` mantendo todos os checkboxes mas adicionando:

1. **Tabela de índice** no topo (antes do primeiro `## 1.`):

```markdown
| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-<slug>.md](./tasks/task-01-<slug>.md) |
| 2 | [task-02-<slug>.md](./tasks/task-02-<slug>.md) |
...

**Ordem de execução:** 1 → 2 → ... (indicar paralelismo se existir)

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs
```

2. **Link 📄** em cada cabeçalho de grupo:

```markdown
## 1. Nome do Grupo

📄 [Detalhes](./tasks/task-01-<slug>.md)

- [ ] 1.1 ...
```

---

## Output final

Após concluir todos os 6 passos, resumir:

```
Change: <name>
Local: openspec/changes/<name>/

Artefatos criados:
- proposal.md
- design.md
- specs/<capability>/spec.md
- tasks.md (com links para tasks enriquecidas)
- tasks/task-01-*.md
- tasks/task-02-*.md
  ...

Pronto para implementação.
Use /opsx:apply para começar.
```

---

## Guardrails

- Não implementar código de aplicação nesta skill (só artefatos OpenSpec).
- Não criar arquivos de task vazios — se não há conteúdo suficiente, leia mais do codebase antes de escrever.
- Manter checkboxes de `tasks.md` intactos (não alterar itens `- [ ]`).
- Ler arquivos de código real antes de escrever detalhes técnicos nos arquivos de task (evitar inventar paths ou schemas).
