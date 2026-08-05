# Task 2 — Fundações do módulo admin no gym-ctrl

**Change:** `painel-super-admin`
**Grupo:** 2 de 6
**Pré-requisitos:** [Task 1](./task-01-schema-e-bootstrap-de-identidade.md)
**Desbloqueia:** [Tasks 3–6](./task-03-api-de-tenants-e-users.md) (APIs admin)

## Objetivo do grupo

`AdminModule` plugado no gym, Swagger com Bearer, e autorização `SUPER_ADMIN` comprovada (403/401).

## Contexto para o subagent

- App entry: `apps/gym-ctrl/src/main.ts` — Swagger em `/api`, título “Gestão de Leads”; **ainda sem** `addBearerAuth`.
- Module root: `apps/gym-ctrl/src/gym.module.ts` — importa `AuthModule`, `PrismaModule`.
- Guards globais já registrados em `apps/gym-ctrl/src/modules/auth.module.ts` (`AuthGuard`, `RolesGuard`).
- Decorator: `libs/decorators/roles.decorator.ts` → `@RolesAuth(...roles)`.
- Rotas públicas usam `@Public()` de `@core/decorators/public.decorator`.
- Controllers admin **não** devem ser `@Public()`.
- Path alias `@core/*` já usado no projeto.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/*.controller.ts` (stub mínimo ou health admin) | criar |
| `apps/gym-ctrl/src/gym.module.ts` | editar |
| `apps/gym-ctrl/src/main.ts` | editar (Bearer) |

---

## 2.1 — Criar AdminModule

### O que fazer

1. Criar `apps/gym-ctrl/src/modules/admin/admin.module.ts`.
2. Por ora pode exportar um controller stub `GET /admin/health` (protegido) **ou** deixar controllers vazios até o grupo 3 — preferível um stub para smoke de auth.
3. Importar `AdminModule` em `GymModule`.
4. Usar `PrismaModule` se services precisarem (sim, preparar imports).

### Critérios de aceite

- [ ] App compila com `AdminModule` importado
- [ ] Prefixo de rotas admin começa com `admin`

### Não fazer

- Não registrar outro `APP_GUARD` duplicado no AdminModule
- Não criar frontend

---

## 2.2 — Swagger Bearer JWT

### O que fazer

Em `main.ts` DocumentBuilder:

```ts
.addBearerAuth() // ou .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
```

Nos controllers admin: `@ApiBearerAuth()` + `@ApiTags('Admin')`.

Garantir que o UI Swagger permita Authorize com o token do login.

### Critérios de aceite

- [ ] Swagger `/api` mostra esquema Bearer
- [ ] Endpoints admin listados sob tag Admin (quando existirem)

### Não fazer

- Não quebrar CORS existente

---

## 2.3 — @RolesAuth(SUPER_ADMIN)

### O que fazer

Em todo controller admin (incluindo stub):

```ts
import { RolesAuth } from '@core/decorators/roles.decorator';
import { Roles } from '@prisma/client';

@RolesAuth(Roles.SUPER_ADMIN)
@Controller('admin')
export class AdminHealthController { ... }
```

Pode ser no nível da classe.

### Critérios de aceite

- [ ] Nenhuma rota `/admin/*` é `@Public`
- [ ] Metadata de roles exige `SUPER_ADMIN`

### Não fazer

- Não mudar comportamento de `/auth/login` ou `/health-check`

---

## 2.4 — Smoke 401 / 403

### O que fazer

1. Sem Authorization → `GET /admin/health` (ou primeira rota) → **401**
2. Login com user tenant `ADMIN` (se existir) → Bearer → **403**
3. Login platform admin → **200** no stub

Se não houver user ADMIN de tenant no ambiente, criar um temporário via Prisma/SQL só para o teste, ou documentar que 403 será revalidado no grupo 6.

### Critérios de aceite

- [ ] 401 sem token
- [ ] 403 com JWT sem `SUPER_ADMIN`
- [ ] 200 com `SUPER_ADMIN` no stub

### Não fazer

- Não enfraquecer `RolesGuard`

---

## Verificação do grupo

Compile + três curls de auth acima

## Handoff para próxima task

Grupos 3–6 implementam controllers reais no `AdminModule` já autorizado e documentado.
