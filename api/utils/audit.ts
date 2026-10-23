import { AuditLog } from "../models/AuditLog";

export async function logAudit(entry: {
  actorId: string;
  action: string;
  targetId?: string;
  details?: unknown;
  ip?: string;
}) {
  try {
    await AuditLog.create(entry);
  } catch (error) {
    console.error("audit log failed ", error);
  }
}
