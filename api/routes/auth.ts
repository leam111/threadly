import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { RefreshToken } from "../models/RefreshTokens";
import { generateRefreshToken, hashToken } from "../utils/tokens";
import crypto from "crypto";

import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/requireAuth";
import { registerLimiter, loginLimiter,RefreshLimiter } from "../middleware/rateLimiters";
import { setDefaultResultOrder } from "dns";
import { logAudit } from "../utils/audit";
const router = Router();
const fakeHash = bcrypt.hashSync("fakepassword", 12); // fake hash to prevent timing attacks

const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const passwordRules = z.string().min(8).regex(/[A-Za-z]/, "at least one letter is required")
.regex(/[0-9]/, "at least one number is required");




const registerSchema = z.object({
  email: z.email(),
  password: passwordRules});
//1
router.post("/register", registerLimiter, async (req, res) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      message:
        "the email must be valid and the password needs at least 8 characters , with a letter and a number",
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

    res.status(201).json({
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

router.post("/login", loginLimiter, async (req, res) => {
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

if(["admin","superadmin"].includes(user.role)){
  void logAudit({
    actorId:user._id.toString(),
    action:"auth.login.failure",
    details:{reason:user.isActive?"wrong password":"account off"},
    ip:req.ip,
  })
}


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

  const refreshToken = generateRefreshToken();

  const familyId = crypto.randomUUID();

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: new Date(Date.now() + REFRESH_MS),
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: REFRESH_MS,
    path: "/auth",
  });


  if (["admin", "superadmin"].includes(user.role)) {
    void logAudit({
      actorId: user._id.toString(),
      action: "auth.login.success",
      ip: req.ip,
    });
  }


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

router.post("/refresh",RefreshLimiter, async (req, res) => {
  const cookie = req.cookies.refreshToken;

  if (typeof cookie !== "string") {
    res.status(401).json({ message: "log in first" });
    return;
  }

  const tokenHash = hashToken(cookie);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored) {
    res.status(401).json({ message: "invalid refresh token" });
    return;
  }

if (stored.usedAt) {
  await RefreshToken.updateMany(
{ familyId: stored.familyId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  res.status(401).json({ message: "invalid refresh token" });
  return;
}




  if (stored.expiresAt < new Date() || stored.usedAt || stored.revokedAt) {
    res.status(401).json({ message: "invalid refresh token" });
    return;
  }

  const userFound = await User.findById(stored.userId);

  if (!userFound || !userFound.isActive) {
    res.status(401).json({ message: "invalid refresh token" });
    return;
  }

  stored.usedAt = new Date();
  await stored.save();
  const newRefreshToken = generateRefreshToken();
  await RefreshToken.create({
    userId: stored.userId,
    tokenHash: hashToken(newRefreshToken),
    familyId: stored.familyId,
    expiresAt: new Date(Date.now() + REFRESH_MS),
  });

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in .env");
  }

  const accessToken = jwt.sign(
    { sub: userFound._id.toString(), role: userFound.role },
    secret,
    { expiresIn: "15m" },
  );

  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: REFRESH_MS,
    path: "/auth",
  });

  res.json({ accessToken });
});




router.post("/logout", async (req, res) => {
  const cookie = req.cookies.refreshToken;

  if (typeof cookie === "string") {
    const tokenHash = hashToken(cookie);
    const stored = await RefreshToken.findOne({ tokenHash });

    if (stored) {
stored.revokedAt = new Date();
await stored.save();
}
  }

  res.clearCookie("refreshToken", { path: "/auth" });
  res.json({ message: "logged out" });
});


router.post("/logout-others", requireAuth, async (req, res) => {
  const cookie = req.cookies.refreshToken;

  if (typeof cookie !== "string") {
    res.status(401).json({ message: "log in first" });
    return;
  }

  const tokenHash = hashToken(cookie);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored) {
    res.status(401).json({ message: "invalid refresh token" });
    return;
  }
if (stored.userId.toString() !== res.locals.user.id) {
  res.status(401).json({ message: "invalid refresh token" });
  return;
}

  await RefreshToken.updateMany(
    {
      userId: stored.userId,
      familyId: { $ne: stored.familyId },
      revokedAt: { $exists: false },
    },
    { $set: { revokedAt: new Date() } },
  );

  res.json({ message: "other sessions logged out" });
});



const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordRules,
});

router.post("/change-password",requireAuth,async(req,res)=>{

  const result = changePasswordSchema.safeParse(req.body);

if(!result.success){
  res.status(400).json({message:"invalid input"});
  return;
}

const user = await User.findById(res.locals.user.id);

if(!user||!user.isActive){
  res.status(401).json({message:"you need to log in again"});
return ;
}


const passwordOk = await bcrypt.compare(result.data.currentPassword,user.passwordHash);


if(!passwordOk){
  res.status(401).json({message:"current password is wrong"});
  return ;
}

user.passwordHash=await bcrypt.hash(result.data.newPassword,12);
await user.save();


await RefreshToken.updateMany(
    { userId: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );

  res.clearCookie("refreshToken", { path: "/auth" });
  res.json({ message: "password changed, please log in again" });


});






const deactivateSchema = z.object({
  currentPassword: z.string().min(1)
});

router.post("/deactivate", requireAuth, async (req, res) => {
const result = deactivateSchema.safeParse(req.body);
  
  if(!result.success){
    res.status(400).json({message:"invalid input"});
    return ;
  }
  

const user = await User.findById(res.locals.user.id);

if(!user||!user.isActive){
res.status(401).json({ message: "log in again" });
return;
}


const passwordOk = await bcrypt.compare(result.data.currentPassword,user.passwordHash);


if(!passwordOk){
  res.status(401).json({message:"password is wrong"});
  return;
}


user.isActive=false;
await user.save();

await RefreshToken.updateMany(

{userId:user._id ,revokedAt:{$exists:false}},
{$set:{revokedAt:new Date()}},
);


res.clearCookie("refreshToken",{path:"/auth"});
res.json({message:"account deactivated"});

});







export default router;
