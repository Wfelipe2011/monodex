/* eslint-disable */
export default async () => {
    const t = {
        ["./dtos/create-user.dto"]: await import("./dtos/create-user.dto")
    };
    return { "@nestjs/swagger": { "models": [[import("./dtos/create-user.dto"), { "CreateUserDto": { email: { required: true, type: () => String }, password: { required: true, type: () => String }, isEnabled: { required: false, type: () => Boolean, default: true } } }]], "controllers": [[import("./gym-ctrl.controller"), { "GymCtrlController": { "getHello": { type: t["./dtos/create-user.dto"].CreateUserDto }, "createUser": { type: t["./dtos/create-user.dto"].CreateUserDto } } }]] } };
};