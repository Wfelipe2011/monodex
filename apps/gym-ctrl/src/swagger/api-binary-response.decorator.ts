import { ApiOkResponse } from '@nestjs/swagger';

/** Resposta binária (StreamableFile, arquivo, imagem). */
export function ApiOkBinaryResponse(description: string, mediaType = 'application/octet-stream') {
  return ApiOkResponse({
    description,
    content: {
      [mediaType]: {
        schema: { type: 'string', format: 'binary' },
        example: '(bytes do arquivo)',
      },
    },
  });
}

/** CSV ou texto plano para download. */
export function ApiOkTextDownloadResponse(
  description: string,
  mediaType = 'text/csv',
) {
  return ApiOkResponse({
    description,
    content: {
      [mediaType]: {
        schema: { type: 'string' },
        example: 'name,phone,website,category\nExemplo,5511999999999,,',
      },
    },
  });
}
