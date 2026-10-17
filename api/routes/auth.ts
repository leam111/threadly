import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/requireAuth";
import {registerLimiter,loginLimiter} from "../middleware/rateLimiters";
const router = Router();
const fakeHash = bcrypt.hashSync("fakepassword", 12); // fake hash to prevent timing attacks

const registerSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/, "at least one letter is required").regex(/[0-9]/,"at least one number is required")
    ,
});
//1
router.post("/register",registerLimiter, async (req, res) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res
      .status(400)
      .json({
        message: "the email must be valid and the password needs at least 8 characters , with a letter and a number",
      });
    return;
  }

  const email = result.data.email.toLowerCase();
  const { password } = result.data;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    res.status(409).json({ message: "user with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({ email, passwordHash });

    res
      .status(201)
      .json({
        message: "user created successfully",
        userId: user._id,
        email: user.email,
        role: user.role,
      });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({ message: "user with this email already exists" });
      return;
    }

    throw error;
  }
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
//2

router.post("/login",loginLimiter, async (req, res) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  const email = result.data.email.toLowerCase();
  const { password } = result.data;

  const user = await User.findOne({ email });

  if (!user) {
    await bcrypt.compare(password, fakeHash);
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);

  if (!user || !user.isActive || !passwordOk) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in .env");
  }

  const accessToken = jwt.sign(
    { sub: user._id.toString(), role: user.role },
    secret,
    { expiresIn: "15m" },
  );

  res.json({
    accessToken,
    user: { id: user._id, email: user.email, role: user.role },
  });
});
//3
router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(res.locals.user.id);

  if (!user || !user.isActive) {
    res.status(401).json({ message: "Log in again" });
    return;
  }

  res.json({ id: user._id, email: user.email, role: user.role });
});













export default router;
