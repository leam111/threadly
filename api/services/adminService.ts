import { AppError } from "../utils/appError";
import { isValidId } from "../utils/ids";
import { logAudit } from "../utils/audit";
import type { Actor } from "../policies/itemPolicy";
import type { AuditQuery, UserListQuery } from "../dtos/adminDto";
import type { UserRepository } from "../repositories/userRepository";
import type { RefreshTokenRepository } from "../repositories/refreshTokenRepository";
import type { AuditRepository } from "../repositories/auditRepository";
import type { RoleRepository } from "../repositories/roleRepository";
import type { PermissionRepository } from "../repositories/permissionRepository";

// the permissions a role must never lose, or nobody could change roles any more
const SUPERADMIN_MUST_KEEP = ["role:assign", "permission:edit"];

type Deps = {
  users: UserRepository;
  tokens: RefreshTokenRepository;
  audit: AuditRepository;
  roles: RoleRepository;
  permissions: PermissionRepository;
};

export function makeAdminService({ users, tokens, audit, roles, permissions }: Deps) {
  // true when this user is the only active superadmin left
  // (there must always be at least one, or nobody could change roles any more)
  async function isLastActiveSuperadmin(user: { role?: string | null; isActive?: boolean | null }) {
    if (user.role !== "superadmin" || !user.isActive) {
      return false;
    }
    const activeSuperadmins = await users.countActiveSuperadmins();
    return activeSuperadmins <= 1;
  }

  // the user with this id, or a refusal (400 for a bad id, 404 for an unknown user)
  async function findUser(id: string) {
    if (!isValidId(id)) {
      throw new AppError(400, "invalid id!");
    }

    const user = await users.findById(id);
    if (!user) {
      throw new AppError(404, "user not found");
    }
    return user;
  }

  return {
    async setUserActive(actor: Actor, id: string, isActive: boolean, ip: string | undefined) {
      const target = await findUser(id);

      // nobody may switch off their own account
      if (actor.id === target._id.toString() && isActive === false) {
        throw new AppError(400, "you cannot switch off your own account");
      }

      // only a superadmin may change another superadmin
      if (target.role === "superadmin" && actor.role !== "superadmin") {
        throw new AppError(403, "only a superadmin can change a superadmin");
      }

      if (isActive === false && (await isLastActiveSuperadmin(target))) {
        throw new AppError(400, "there must be at least one superadmin");
      }

      await users.setActive(target, isActive);

      await logAudit({
        actorId: actor.id,
        action: target.isActive ? "user.activate" : "user.deactivate",
        targetId: target._id.toString(),
        details: { isActive: target.isActive },
        ip,
      });

      // a user switched off also loses every login
      if (!target.isActive) {
        await tokens.revokeAllForUser(target._id);
      }

      return { isActive: target.isActive };
    },

    async listAudit(query: AuditQuery) {
      const page = query.page;
      const limit = Math.min(query.limit, 50);
      const { total, items } = await audit.list(query.action, page, limit);
      return { page, limit, total, items };
    },

    async listUsers(query: UserListQuery) {
      const page = query.page;
      const limit = Math.min(query.limit, 50);
      const { total, items } = await users.list(
        { email: query.email, role: query.role, status: query.status },
        page,
        limit,
      );
      return { page, limit, total, items };
    },

    listPermissions() {
      return permissions.listAll();
    },

    async listRoles() {
      const list = await roles.listAll();
      const rows = await roles.listAllRows();
      return { roles: list, rows };
    },

    // replaces the whole permission list of one role
    // the guard reads the database on every request, so the change works at once
    async replaceRolePermissions(
      actor: Actor,
      name: string,
      names: string[],
      ip: string | undefined,
    ) {
      // the same name twice counts once
      const wanted = [...new Set(names)].sort();

      // every name must be a real permission
      const known = await permissions.countKnown(wanted);
      if (known !== wanted.length) {
        throw new AppError(400, "invalid input");
      }

      const role = await roles.findByName(name);
      if (!role) {
        throw new AppError(404, "role not found");
      }

      if (
        role.name === "superadmin" &&
        !SUPERADMIN_MUST_KEEP.every((permission) => wanted.includes(permission))
      ) {
        throw new AppError(400, "superadmin must keep role:assign and permission:edit");
      }

      const before = await roles.permissionsOf(role.name);
      const added = wanted.filter((permission) => !before.includes(permission));
      const removed = before.filter((permission) => !wanted.includes(permission)).sort();

      if (added.length > 0) {
        await roles.addPermissions(role.name, added);
      }
      if (removed.length > 0) {
        await roles.removePermissions(role.name, removed);
      }

      // targetId can only hold a user id, so the role name goes in the details
      await logAudit({
        actorId: actor.id,
        action: "permission.edit",
        details: { role: role.name, added, removed },
        ip,
      });

      return { role: role.name, permissions: wanted };
    },

    async setUserRole(actor: Actor, id: string, newRole: string, ip: string | undefined) {
      const target = await findUser(id);

      // the role must exist in the database
      if (!(await roles.exists(newRole))) {
        throw new AppError(400, "invalid input");
      }

      if (actor.id === target._id.toString()) {
        throw new AppError(400, "you cannot change your own role");
      }

      const oldRole = target.role;
      if (oldRole === newRole) {
        throw new AppError(400, "nothing to change");
      }

      // giving or taking the superadmin role, or changing a superadmin: superadmin only
      if ((oldRole === "superadmin" || newRole === "superadmin") && actor.role !== "superadmin") {
        throw new AppError(403, "only a superadmin can change a superadmin");
      }

      if (await isLastActiveSuperadmin(target)) {
        throw new AppError(400, "there must be at least one superadmin");
      }

      await users.setRole(target, newRole);

      await logAudit({
        actorId: actor.id,
        action: "role.assign",
        targetId: target._id.toString(),
        details: { from: oldRole, to: newRole },
        ip,
      });

      return { role: newRole };
    },
  };
}

export type AdminService = ReturnType<typeof makeAdminService>;
