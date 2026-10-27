import { Request, Response, NextFunction } from "express";
import { roleRepository } from "../repositories/roleRepository";
import { PermissionName } from "../utils/permissions";

// use after requireAuth: "does the role of this user allow this action?"
// it asks the database on EVERY request (no cache), so a change to a role works at once
// FAIL CLOSED: an unknown role, a missing row or a database error always means "no"
export function requirePermission(name: PermissionName) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;

    if (!user) {
      res.status(401).json({ message: "Log in first" });
      return;
    }

    let allowed = false;
    try {
      const role = await roleRepository.exists(user.role);
      const row = role ? await roleRepository.hasPermission(user.role, name) : null;
      allowed = row !== null;
    } catch (error) {
      // the message only: never the whole error, the request or the token
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("permission check failed:", message);
    }

    if (!allowed) {
      res.status(403).json({ message: "You are not allowed here" });
      return;
    }

    next();
  };
}
