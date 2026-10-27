// The one place where the pieces are put together (simple dependency injection):
// each service gets the repositories it needs, here and only here.
// Controllers take their service from this file.
import { profileRepository } from "./repositories/profileRepository";
import { makeProfileService } from "./services/profileService";
import { itemRepository } from "./repositories/itemRepository";
import { makeItemService } from "./services/itemService";

export const profileService = makeProfileService({ profiles: profileRepository });
export const itemService = makeItemService({ items: itemRepository });
