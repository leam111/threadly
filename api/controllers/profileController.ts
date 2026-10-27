import { Request, Response } from "express";
import { profileService } from "../container";
import { editProfileSchema, toProfileDto } from "../dtos/profileDto";

export async function getMyProfile(req: Request, res: Response) {
  const userId = res.locals.user.id;
  const profile = await profileService.getMine(userId);
  res.json(toProfileDto(userId, profile));
}

export async function updateMyProfile(req: Request, res: Response) {
  const result = editProfileSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const userId = res.locals.user.id;
  const profile = await profileService.updateMine(userId, result.data);
  res.json(toProfileDto(userId, profile));
}
