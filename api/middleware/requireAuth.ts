import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Log in first" });
    return;
  }

  const token = header.slice(7);

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in .env");
  }

  try {
    const payload = jwt.verify(token, secret);

    if (typeof payload === "string") {
      res.status(401).json({ message: "Log in again" });
      return;
    }

    res.locals.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: "Log in again" });
  }
}