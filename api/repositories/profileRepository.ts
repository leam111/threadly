import { Profile } from "../models/Profile";

// every database query for profiles lives here
export const profileRepository = {
  // the profile of this user, or null (a plain object, not a Mongoose document)
  findByUser(userId: string) {
    return Profile.findOne({ userId }).lean();
  },

  // save some fields and remove others, in one update
  // upsert: update my profile, or create it if it does not exist yet
  upsertForUser(userId: string, changes: { set: Record<string, unknown>; unset: string[] }) {
    const update: Record<string, unknown> = {};
    if (Object.keys(changes.set).length > 0) {
      update.$set = changes.set;
    }
    if (changes.unset.length > 0) {
      update.$unset = Object.fromEntries(changes.unset.map((path) => [path, ""]));
    }

    return Profile.findOneAndUpdate({ userId }, update, {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    }).lean();
  },

  // save the new avatar path (and create the profile if there is none yet)
  // gives the profile as it was BEFORE, so the caller knows the old avatar file
  setAvatar(userId: string, storagePath: string) {
    return Profile.findOneAndUpdate(
      { userId },
      { $set: { avatarStoragePath: storagePath } },
      { upsert: true, returnDocument: "before", runValidators: true, setDefaultsOnInsert: true },
    ).lean();
  },

  // remove the avatar path, but only if it is still this one
  // (if a new avatar was saved in between, it is kept)
  async clearAvatar(userId: string, storagePath: string) {
    await Profile.updateOne(
      { userId, avatarStoragePath: storagePath },
      { $unset: { avatarStoragePath: "" } },
    );
  },
};

export type ProfileRepository = typeof profileRepository;
