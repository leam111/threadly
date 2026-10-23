import { Request, Response, NextFunction } from "express";

export function requireRole(allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;

    //if user is not logged in, return 401
    if (!user) {
      res.status(401).json({ message: "Log in first" });
      return;
    }
    //if this user's role is in the list allowed up in the constructor
    if (!allowed.includes(user.role)) {
      res.status(403).json({ message: "You are not allowed here" });
      return;
    }

    next();
    //next means approved
  };
}
