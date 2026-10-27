import { AuditLog } from "../models/AuditLog";

export type AuditEntry = {
  actorId: string;
  action: string;
  targetId?: string;
  details?: unknown;
  ip?: string;
};

// every database query for the audit log lives here
export const auditRepository = {
  create(entry: AuditEntry) {
    return AuditLog.create(entry);
  },

  // one page of rows, newest first; with an action, only the rows of that action
  async list(action: string | undefined, page: number, limit: number) {
    const filter = action ? { action } : {};

    const total = await AuditLog.countDocuments(filter);
    const items = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return { total, items };
  },
};

export type AuditRepository = typeof auditRepository;
