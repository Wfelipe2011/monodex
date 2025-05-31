import { ApiProperty } from "@nestjs/swagger";

export class LoginInput {
  @ApiProperty({ description: 'Email do usuário', example: 'john@gmail.com', required: true })
  email: string;
  @ApiProperty({ description: 'Senha do usuário', example: '123456', required: true })
  password: string;
}

export class LoginOutput {
  @ApiProperty({ description: 'Token JWT', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;
}