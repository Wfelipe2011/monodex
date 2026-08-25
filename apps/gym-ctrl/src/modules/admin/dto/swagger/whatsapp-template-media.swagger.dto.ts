import { ApiProperty } from '@nestjs/swagger';

/** Resposta de POST /platform/whatsapp-templates/media (handle Meta opaco). */
export class MetaMediaHandleResponseDto {
  @ApiProperty({
    description:
      'Handle opaco da Meta para header_handle de template ou profile_picture_handle',
    example:
      '4:aW1hZ2UvanBlZw==:ARZ9oTHzo9igJVD5QgwemUWSkOv3vl4dzdBovSFUy2yz5fFAgSqDZOI',
  })
  handle: string;
}
