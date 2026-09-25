import { ApiProperty } from '@nestjs/swagger';

/** Corpo padrão de erro HTTP retornado pelo NestJS (ValidationPipe, HttpException, etc.). */
export class HttpErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    description: 'Mensagem única ou lista (validação class-validator)',
    oneOf: [
      { type: 'string', example: 'Campo inválido' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['email must be an email', 'password should not be empty'],
      },
    ],
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}

const HTTP_ERROR_SCHEMA = { $ref: '#/components/schemas/HttpErrorResponseDto' };

export function apiErrorJsonContent(
  statusCode: number,
  message: string | string[],
  error: string,
) {
  return {
    'application/json': {
      schema: HTTP_ERROR_SCHEMA,
      example: { statusCode, message, error },
    },
  };
}

export const API_ERROR_EXAMPLES = {
  unauthorized: apiErrorJsonContent(401, 'Unauthorized', 'Unauthorized'),
  forbiddenPlatform: apiErrorJsonContent(
    403,
    'Acesso negado — requer SUPER_ADMIN',
    'Forbidden',
  ),
  forbiddenTenant: apiErrorJsonContent(
    403,
    'Tenant inativo, escopo incorreto ou role insuficiente',
    'Forbidden',
  ),
  forbiddenSuperAdminNoPontape: apiErrorJsonContent(
    403,
    'Acesso não permitido',
    'Forbidden',
  ),
  validation: apiErrorJsonContent(
    400,
    ['name should not be empty', 'phone must be a string'],
    'Bad Request',
  ),
  badRequest: (message: string) =>
    apiErrorJsonContent(400, message, 'Bad Request'),
  notFound: (message: string) =>
    apiErrorJsonContent(404, message, 'Not Found'),
  conflict: (message: string) =>
    apiErrorJsonContent(409, message, 'Conflict'),
};
