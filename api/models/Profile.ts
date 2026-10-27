import { Schema, model } from "mongoose";
import {
  PROFILE_STYLES,
  DISPLAY_NAME_MAX,
  BIO_MAX,
  CITY_MAX,
  COUNTRY_MAX,
  SIZE_MAX,
  STYLES_MAX,
  FAVORITE_COLORS_MAX,
  COLOR_WORD_MAX,
} from "../utils/profileOptions";

const sizeField = { type: String, trim: true, maxLength: SIZE_MAX };

const ProfileSchema = new Schema(
  {
    // unique: one profile per user. unique also builds the index on userId
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    displayName: { type: String, trim: true, minLength: 1, maxLength: DISPLAY_NAME_MAX },
    bio: { type: String, trim: true, maxLength: BIO_MAX },
    city: { type: String, trim: true, maxLength: CITY_MAX },
    country: { type: String, trim: true, maxLength: COUNTRY_MAX },
    sizes: {
      top: sizeField,
      bottom: sizeField,
      dress: sizeField,
      shoes: sizeField,
    },
    styles: {
      type: [{ type: String, enum: PROFILE_STYLES }],
      validate: [
        {
          validator: (list: string[]) => list.length <= STYLES_MAX,
          message: `at most ${STYLES_MAX} styles`,
        },
        {
          validator: (list: string[]) => new Set(list).size === list.length,
          message: "styles must not repeat",
        },
      ],
    },
    // free words like "navy" or "sage green": trimmed, lowercase, never twice
    favoriteColors: {
      type: [
        { type: String, trim: true, lowercase: true, minLength: 1, maxLength: COLOR_WORD_MAX },
      ],
      // no empty list is stored for a profile that never had one
      default: undefined,
      validate: [
        {
          validator: (list: string[]) => list.length <= FAVORITE_COLORS_MAX,
          message: `at most ${FAVORITE_COLORS_MAX} favorite colors`,
        },
        {
          validator: (list: string[]) => new Set(list).size === list.length,
          message: "favorite colors must not repeat",
        },
      ],
    },
  },
  { timestamps: true },
);

export const Profile = model("Profile", ProfileSchema);
