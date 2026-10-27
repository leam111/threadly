import { auditRepository, AuditEntry } from "../repositories/auditRepository";

export async function logAudit(entry: AuditEntry) {
  try {
    await auditRepository.create(entry);
  } catch (error) {
    console.error("audit log failed ", error);
  }
}
