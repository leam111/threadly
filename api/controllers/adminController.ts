import { Request, Response } from "express";
import { adminService } from "../container";
import {
  activeSchema,
  auditQuerySchema,
  userListQuerySchema,
  rolePermissionsSchema,
  userRoleSchema,
  toRoleListDto,
} from "../dtos/adminDto";

export async function setUserActive(req: Request, res: Response) {
  const result = activeSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const { isActive } = await adminService.setUserActive(
    res.locals.user,
    req.params.id as string,
    result.data.isActive,
    req.ip,
  );
  res.json({ message: "user updated", isActive });
}

export async function listAudit(req: Request, res: Response) {
  const result = auditQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ message: "invalid query" });
    return;
  }

  res.json(await adminService.listAudit(result.data));
}

export async function listUsers(req: Request, res: Response) {
  const result = userListQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ message: "invalid query" });
    return;
  }

  res.json(await adminService.listUsers(result.data));
}

export async function listPermissions(req: Request, res: Response) {
  const items = await adminService.listPermissions();
  res.json({ items });
}

export async function listRoles(req: Request, res: Response) {
  const { roles, rows } = await adminService.listRoles();
  res.json({ items: toRoleListDto(roles, rows) });
}

export async function replaceRolePermissions(req: Request, res: Response) {
  const result = rolePermissionsSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const { role, permissions } = await adminService.replaceRolePermissions(
    res.locals.user,
    req.params.name as string,
    result.data.permissions,
    req.ip,
  );
  res.json({ message: "role updated", role, permissions });
}

export async function setUserRole(req: Request, res: Response) {
  const result = userRoleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const { role } = await adminService.setUserRole(
    res.locals.user,
    req.params.id as string,
    result.data.role,
    req.ip,
  );
  res.json({ message: "role updated", role });
}
