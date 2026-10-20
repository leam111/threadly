import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    res.status(401).json({ message: "Log in again" });
    return;
  }

  if (typeof payload === "string") {
    res.status(401).json({ message: "Log in again" });
    return;
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    res.status(401).json({ message: "Log in again" });
    return;
  }

  res.locals.user = { id: user._id.toString(), role: user.role };
  next();
}