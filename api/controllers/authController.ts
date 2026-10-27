import { Request, Response, CookieOptions } from "express";
import { authService } from "../container";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  deactivateSchema,
  toUserDto,
} from "../dtos/authDto";
import { REFRESH_MS } from "../utils/tokens";

// the refresh token travels only in this cookie, and only to /auth
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: REFRESH_MS,
  path: "/auth",
};

function clearRefreshCookie(res: Response) {
  res.clearCookie("refreshToken", { path: "/auth" });
}

export async function register(req: Request, res: Response) {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      message:
        "the email must be valid and the password needs at least 8 characters , with a letter and a number",
    });
    return;
  }

  const user = await authService.register(result.data.email, result.data.password);
  res.status(201).json({
    message: "user created successfully",
    userId: user._id,
    email: user.email,
    role: user.role,
  });
}

export async function login(req: Request, res: Response) {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  const { accessToken, refreshToken, user } = await authService.login(
    result.data.email,
    result.data.password,
    req.ip,
  );
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
  res.json({ accessToken, user: toUserDto(user) });
}

export async function me(req: Request, res: Response) {
  const user = await authService.me(res.locals.user);
  res.json(toUserDto(user));
}

export async function refresh(req: Request, res: Response) {
  const { accessToken, refreshToken } = await authService.refresh(req.cookies.refreshToken);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
  res.json({ accessToken });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies.refreshToken);
  clearRefreshCookie(res);
  res.json({ message: "logged out" });
}

export async function logoutOthers(req: Request, res: Response) {
  await authService.logoutOthers(res.locals.user, req.cookies.refreshToken);
  res.json({ message: "other sessions logged out" });
}

export async function changePassword(req: Request, res: Response) {
  const result = changePasswordSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  await authService.changePassword(
    res.locals.user,
    result.data.currentPassword,
    result.data.newPassword,
  );
  clearRefreshCookie(res);
  res.json({ message: "password changed, please log in again" });
}

export async function deactivate(req: Request, res: Response) {
  const result = deactivateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  await authService.deactivate(res.locals.user, result.data.currentPassword);
  clearRefreshCookie(res);
  res.json({ message: "account deactivated" });
}
