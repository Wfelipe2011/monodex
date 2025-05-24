export class CreateUserDto {
    email: string;
    password: string;
    isEnabled?: boolean = true;
}
