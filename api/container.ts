// The one place where the pieces are put together (simple dependency injection):
// each service gets the repositories it needs, here and only here.
// Controllers take their service from this file.
import { profileRepository } from "./repositories/profileRepository";
import { makeProfileService } from "./services/profileService";
import { itemRepository } from "./repositories/itemRepository";
import { makeItemService } from "./services/itemService";
import { userRepository } from "./repositories/userRepository";
import { refreshTokenRepository } from "./repositories/refreshTokenRepository";
import { auditRepository } from "./repositories/auditRepository";
import { roleRepository } from "./repositories/roleRepository";
import { permissionRepository } from "./repositories/permissionRepository";
import { makeAdminService } from "./services/adminService";
import { makeAuthService } from "./services/authService";
import { imageRepository } from "./repositories/imageRepository";
import { makeItemImageService } from "./services/itemImageService";
import { imageStorage } from "./storage/imageStorage";

export const profileService = makeProfileService({ profiles: profileRepository });
export const itemService = makeItemService({ items: itemRepository });
export const itemImageService = makeItemImageService({
  images: imageRepository,
  storage: imageStorage,
});
export const adminService = makeAdminService({
  users: userRepository,
  tokens: refreshTokenRepository,
  audit: auditRepository,
  roles: roleRepository,
  permissions: permissionRepository,
});
export const authService = makeAuthService({
  users: userRepository,
  tokens: refreshTokenRepository,
});
