import { Request, Response } from "express";
import { profileService } from "../container";
import { editProfileSchema, toProfileDto } from "../dtos/profileDto";

export async function getMyProfile(req: Request, res: Response) {
  const userId = res.locals.user.id;
  const { profile, avatarUrl } = await profileService.getMine(userId);
  res.json(toProfileDto(userId, profile, avatarUrl));
}

export async function updateMyProfile(req: Request, res: Response) {
  const result = editProfileSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const userId = res.locals.user.id;
  const { profile, avatarUrl } = await profileService.updateMine(userId, result.data);
  res.json(toProfileDto(userId, profile, avatarUrl));
}

// the file is on req.file (see middleware/receiveImage.ts); the answer is the whole profile
export async function uploadMyAvatar(req: Request, res: Response) {
  const userId = res.locals.user.id;
  const { profile, avatarUrl } = await profileService.setAvatar(userId, req.file);
  res.json(toProfileDto(userId, profile, avatarUrl));
}

export async function deleteMyAvatar(req: Request, res: Response) {
  const userId = res.locals.user.id;
  await profileService.removeAvatar(userId);
  res.json({ message: "avatar deleted" });
}
