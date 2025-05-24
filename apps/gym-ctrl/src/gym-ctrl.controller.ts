import { Body, Controller, Get, Post } from '@nestjs/common';
import { GymCtrlService } from './gym-ctrl.service';
import { CreateUserDto } from './dtos/create-user.dto';

@Controller()
export class GymCtrlController {
  constructor(private readonly gymCtrlService: GymCtrlService) {}

  @Get()
  getHello(): CreateUserDto {
    return {
      email: '',
      password: '',
      isEnabled: true,
    }
  }

  @Post()
  createUser(@Body() body: CreateUserDto): CreateUserDto {
    return body
  }
}
