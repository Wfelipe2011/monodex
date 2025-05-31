/* eslint-disable */
export default async () => {
    const t = {};
    return { "@nestjs/swagger": { "models": [[import("./dtos/login.dto"), { "LoginInput": { email: { required: true, type: () => String }, password: { required: true, type: () => String } }, "LoginOutput": { token: { required: true, type: () => String } } }], [import("./dtos/create-user.dto"), { "CreateUserDto": { email: { required: true, type: () => String }, password: { required: true, type: () => String }, isEnabled: { required: false, type: () => Boolean, default: true } } }]], "controllers": [[import("./gym.controller"), { "GymController": { "healthCheck": {} } }], [import("./modules/auth.controller"), { "AuthController": { "login": {} } }]] } };
};