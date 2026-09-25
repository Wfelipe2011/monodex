import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_ERROR_EXAMPLES, apiErrorJsonContent } from './http-error.swagger';

/** Respostas de erro individuais com corpo JSON de exemplo (Nest HttpException). */
export const ApiDocErrors = {
  unauthorized: (description = 'JWT ausente, expirado ou inválido') =>
    ApiUnauthorizedResponse({
      description,
      content: API_ERROR_EXAMPLES.unauthorized,
    }),
  badRequest: (description: string) =>
    ApiBadRequestResponse({
      description,
      content: API_ERROR_EXAMPLES.badRequest(description),
    }),
  forbidden: (description: string) =>
    ApiForbiddenResponse({
      description,
      content: apiErrorJsonContent(403, description, 'Forbidden'),
    }),
  notFound: (description: string) =>
    ApiNotFoundResponse({
      description,
      content: API_ERROR_EXAMPLES.notFound(description),
    }),
  conflict: (description: string) =>
    ApiConflictResponse({
      description,
      content: API_ERROR_EXAMPLES.conflict(description),
    }),
};

export type RouteErrorOptions = {
  /** Inclui 401 com exemplo (default true em rotas autenticadas). */
  unauthorized?: boolean;
  /** Descrição + mensagem de exemplo para 403. */
  forbidden?: string | false;
  /** Descrição + mensagem de exemplo para 404. */
  notFound?: string | false;
  /** Descrição + mensagem de exemplo para 400. */
  badRequest?: string | false;
  /** Descrição + mensagem de exemplo para 409. */
  conflict?: string | false;
};

function forbiddenContent(message: string) {
  return {
    'application/json': {
      schema: { $ref: '#/components/schemas/HttpErrorResponseDto' },
      example: { statusCode: 403, message, error: 'Forbidden' },
    },
  };
}

/** Erros comuns configuráveis por endpoint (401/400/403/404/409 com corpo de exemplo). */
export function ApiRouteErrors(opts: RouteErrorOptions = {}) {
  const {
    unauthorized = true,
    forbidden = 'Acesso negado para este recurso ou tenant',
    notFound = false,
    badRequest = false,
    conflict = false,
  } = opts;

  const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> =
    [];

  if (unauthorized) {
    decorators.push(
      ApiUnauthorizedResponse({
        description: 'JWT ausente, expirado ou inválido',
        content: API_ERROR_EXAMPLES.unauthorized,
      }),
    );
  }

  if (badRequest) {
    const msg =
      typeof badRequest === 'string' ? badRequest : 'Validação do body ou query falhou';
    decorators.push(
      ApiBadRequestResponse({
        description: msg,
        content: API_ERROR_EXAMPLES.badRequest(msg),
      }),
    );
  }

  if (forbidden) {
    const msg =
      typeof forbidden === 'string'
        ? forbidden
        : 'Tenant inativo, escopo incorreto ou role insuficiente';
    decorators.push(
      ApiForbiddenResponse({
        description: msg,
        content: forbiddenContent(msg),
      }),
    );
  }

  if (notFound) {
    const msg =
      typeof notFound === 'string' ? notFound : 'Recurso não encontrado';
    decorators.push(
      ApiNotFoundResponse({
        description: msg,
        content: API_ERROR_EXAMPLES.notFound(msg),
      }),
    );
  }

  if (conflict) {
    const msg =
      typeof conflict === 'string' ? conflict : 'Conflito de estado ou duplicidade';
    decorators.push(
      ApiConflictResponse({
        description: msg,
        content: API_ERROR_EXAMPLES.conflict(msg),
      }),
    );
  }

  return applyDecorators(...decorators);
}

/** Rotas `platform/*` exclusivas de SUPER_ADMIN. */
export function ApiPlatformSuperAdminErrors(
  extra: Omit<RouteErrorOptions, 'unauthorized' | 'forbidden'> = {},
) {
  return ApiRouteErrors({
    unauthorized: true,
    forbidden: 'Requer role SUPER_ADMIN',
    ...extra,
  });
}

/** Rotas `tenant/:tenantId/*` com JWT ou X-API-KEY (ADMIN / SUPER_ADMIN). */
export function ApiTenantScopedErrors(
  extra: Omit<RouteErrorOptions, 'unauthorized' | 'notFound' | 'forbidden'> & {
    notFound?: string;
    forbidden?: string | false;
  } = {},
) {
  const {
    notFound = 'Tenant não encontrado',
    forbidden =
      'Tenant inativo, escopo incorreto (tenantId do token ≠ path) ou role insuficiente',
    ...rest
  } = extra;
  return ApiRouteErrors({
    unauthorized: true,
    forbidden,
    notFound,
    ...rest,
  });
}

/** Rotas públicas (sem Bearer); erros típicos 400/403/404/409. */
export function ApiPublicRouteErrors(
  extra: Omit<RouteErrorOptions, 'unauthorized'> = {},
) {
  const { forbidden = false, ...rest } = extra;
  return ApiRouteErrors({
    unauthorized: false,
    forbidden,
    ...rest,
  });
}
