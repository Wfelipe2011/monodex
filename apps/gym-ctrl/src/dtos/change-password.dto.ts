import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Senha atual em plaintext', example: 'antiga' })
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @ApiProperty({
    description: 'Nova senha em plaintext (será hasheada com bcrypt 10 rounds)',
    example: 'nova-senha',
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class ChangePasswordOutput {
  @ApiProperty({ example: true })
  ok: boolean;
}
