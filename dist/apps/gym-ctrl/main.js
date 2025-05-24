/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./apps/gym-ctrl/src/dtos/create-user.dto.ts":
/*!***************************************************!*\
  !*** ./apps/gym-ctrl/src/dtos/create-user.dto.ts ***!
  \***************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CreateUserDto = void 0;
const openapi = __webpack_require__(/*! @nestjs/swagger */ "@nestjs/swagger");
class CreateUserDto {
    constructor() {
        this.isEnabled = true;
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { email: { required: true, type: () => String }, password: { required: true, type: () => String }, isEnabled: { required: false, type: () => Boolean, default: true } };
    }
}
exports.CreateUserDto = CreateUserDto;


/***/ }),

/***/ "./apps/gym-ctrl/src/gym-ctrl.controller.ts":
/*!**************************************************!*\
  !*** ./apps/gym-ctrl/src/gym-ctrl.controller.ts ***!
  \**************************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GymCtrlController = void 0;
const openapi = __webpack_require__(/*! @nestjs/swagger */ "@nestjs/swagger");
const common_1 = __webpack_require__(/*! @nestjs/common */ "@nestjs/common");
const gym_ctrl_service_1 = __webpack_require__(/*! ./gym-ctrl.service */ "./apps/gym-ctrl/src/gym-ctrl.service.ts");
const create_user_dto_1 = __webpack_require__(/*! ./dtos/create-user.dto */ "./apps/gym-ctrl/src/dtos/create-user.dto.ts");
let GymCtrlController = class GymCtrlController {
    constructor(gymCtrlService) {
        this.gymCtrlService = gymCtrlService;
    }
    getHello() {
        return {
            email: '',
            password: '',
            isEnabled: true,
        };
    }
    createUser(body) {
        return body;
    }
};
exports.GymCtrlController = GymCtrlController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: (__webpack_require__(/*! ./dtos/create-user.dto */ "./apps/gym-ctrl/src/dtos/create-user.dto.ts").CreateUserDto) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", create_user_dto_1.CreateUserDto)
], GymCtrlController.prototype, "getHello", null);
__decorate([
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: (__webpack_require__(/*! ./dtos/create-user.dto */ "./apps/gym-ctrl/src/dtos/create-user.dto.ts").CreateUserDto) }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", create_user_dto_1.CreateUserDto)
], GymCtrlController.prototype, "createUser", null);
exports.GymCtrlController = GymCtrlController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [gym_ctrl_service_1.GymCtrlService])
], GymCtrlController);


/***/ }),

/***/ "./apps/gym-ctrl/src/gym-ctrl.module.ts":
/*!**********************************************!*\
  !*** ./apps/gym-ctrl/src/gym-ctrl.module.ts ***!
  \**********************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GymCtrlModule = void 0;
const common_1 = __webpack_require__(/*! @nestjs/common */ "@nestjs/common");
const gym_ctrl_controller_1 = __webpack_require__(/*! ./gym-ctrl.controller */ "./apps/gym-ctrl/src/gym-ctrl.controller.ts");
const gym_ctrl_service_1 = __webpack_require__(/*! ./gym-ctrl.service */ "./apps/gym-ctrl/src/gym-ctrl.service.ts");
let GymCtrlModule = class GymCtrlModule {
};
exports.GymCtrlModule = GymCtrlModule;
exports.GymCtrlModule = GymCtrlModule = __decorate([
    (0, common_1.Module)({
        imports: [],
        controllers: [gym_ctrl_controller_1.GymCtrlController],
        providers: [gym_ctrl_service_1.GymCtrlService],
    })
], GymCtrlModule);


/***/ }),

/***/ "./apps/gym-ctrl/src/gym-ctrl.service.ts":
/*!***********************************************!*\
  !*** ./apps/gym-ctrl/src/gym-ctrl.service.ts ***!
  \***********************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GymCtrlService = void 0;
const common_1 = __webpack_require__(/*! @nestjs/common */ "@nestjs/common");
let GymCtrlService = class GymCtrlService {
    getHello() {
        return 'Hello World!';
    }
};
exports.GymCtrlService = GymCtrlService;
exports.GymCtrlService = GymCtrlService = __decorate([
    (0, common_1.Injectable)()
], GymCtrlService);


/***/ }),

/***/ "@nestjs/common":
/*!*********************************!*\
  !*** external "@nestjs/common" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("@nestjs/common");

/***/ }),

/***/ "@nestjs/core":
/*!*******************************!*\
  !*** external "@nestjs/core" ***!
  \*******************************/
/***/ ((module) => {

module.exports = require("@nestjs/core");

/***/ }),

/***/ "@nestjs/swagger":
/*!**********************************!*\
  !*** external "@nestjs/swagger" ***!
  \**********************************/
/***/ ((module) => {

module.exports = require("@nestjs/swagger");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;
/*!***********************************!*\
  !*** ./apps/gym-ctrl/src/main.ts ***!
  \***********************************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
const core_1 = __webpack_require__(/*! @nestjs/core */ "@nestjs/core");
const swagger_1 = __webpack_require__(/*! @nestjs/swagger */ "@nestjs/swagger");
const gym_ctrl_module_1 = __webpack_require__(/*! ./gym-ctrl.module */ "./apps/gym-ctrl/src/gym-ctrl.module.ts");
async function bootstrap() {
    const app = await core_1.NestFactory.create(gym_ctrl_module_1.GymCtrlModule);
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Gestão de Leads')
        .setDescription('API para gestão de leads')
        .setVersion('1.0')
        .addTag('leads')
        .build();
    const documentFactory = () => swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api', app, documentFactory);
    await app.listen(process.env.GYM_PORT ?? 3000);
}
bootstrap();

})();

/******/ })()
;