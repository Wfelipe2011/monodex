import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Nova senha em plaintext (será hasheada)', example: 'nova-senha' })
  @IsString()
  @MinLength(6)
  password: string;
}
