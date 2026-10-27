import { User } from "../models/User";

// put a "\" before every regex special character, so each one only means itself
function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findById(id: unknown) {
  return User.findById(id);
}

// a user as the database gives it (a Mongoose document)
export type UserDocument = NonNullable<Awaited<ReturnType<typeof findById>>>;

// every database query for users lives here
export const userRepository = {
  findById,

  findByEmail(email: string) {
    return User.findOne({ email });
  },

  // the new user, or null when the email is already taken
  // (two sign-ups at the same moment: the unique index refuses the second one)
  async create(email: string, passwordHash: string) {
    try {
      return await User.create({ email, passwordHash });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        return null;
      }
      throw error;
    }
  },

  async setPasswordHash(user: UserDocument, passwordHash: string) {
    user.passwordHash = passwordHash;
    await user.save();
  },

  countActiveSuperadmins() {
    return User.countDocuments({ role: "superadmin", isActive: true });
  },

  // one page of users, newest first, never with the password hash
  async list(
    filters: { email?: string; role?: string; status?: "active" | "inactive" },
    page: number,
    limit: number,
  ) {
    // the filter is built only from checked data, never from req.query
    const filter: Record<string, unknown> = {};
    if (filters.email) {
      filter.email = { $regex: escapeRegex(filters.email), $options: "i" };
    }
    if (filters.role) {
      filter.role = filters.role;
    }
    if (filters.status) {
      filter.isActive = filters.status === "active";
    }

    const total = await User.countDocuments(filter);
    const items = await User.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return { total, items };
  },

  async setActive(user: UserDocument, isActive: boolean) {
    user.isActive = isActive;
    await user.save();
    return user;
  },

  async setRole(user: UserDocument, role: string) {
    user.set("role", role);
    await user.save();
    return user;
  },
};

export type UserRepository = typeof userRepository;
