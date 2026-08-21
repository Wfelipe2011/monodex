import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@core/decorators/public.decorator';
import { MediaService } from './media.service';

@ApiTags('Public — Media')
@Controller('public/media')
export class PublicMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Public()
  @Get(':publicId')
  @ApiOperation({
    summary: 'Baixar bytes da mídia por publicId (sem autenticação)',
  })
  @ApiParam({
    name: 'publicId',
    description: 'UUID público da mídia (não o id sequencial)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiOkResponse({ description: 'Bytes da imagem com Content-Type da row' })
  @ApiNotFoundResponse({ description: 'publicId desconhecido ou arquivo ausente' })
  async getByPublicId(
    @Param('publicId') publicId: string,
  ): Promise<StreamableFile> {
    const { stream, mimeType } =
      await this.mediaService.openPublicFile(publicId);
    return new StreamableFile(stream, {
      type: mimeType,
      disposition: 'inline',
    });
  }
}
