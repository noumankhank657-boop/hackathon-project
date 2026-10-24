import bcrypt from "bcrypt";
import { db } from "../../lib/db.js";
import { audit } from "../../lib/audit.js";
import { signToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/error-handler.js";

const publicUser = (user: { id: string; email: string; role: "ADMIN" | "HR" | "EMPLOYEE"; mustChangePassword: boolean; employee?: { id: string } | null }) => ({ id: user.id, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword, employeeId: user.employee?.id });

export async function setupCompany(input: { companyName: string; email: string; password: string }) {
  if (await db.user.count({ where: { role: "ADMIN" } })) throw new AppError(409, "Initial setup has already been completed");
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await db.user.create({ data: { email: input.email.toLowerCase(), passwordHash, role: "ADMIN" } });
  await db.setting.create({ data: { key: "company", value: { name: input.companyName } } });
  await audit(user.id, "CREATE", "COMPANY_SETUP", undefined, null, { companyName: input.companyName, adminEmail: user.email });
  return loginResult(user);
}

export async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() }, include: { employee: true } });
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError(401, "Invalid email or password");
  return loginResult(user);
}

async function loginResult(user: Parameters<typeof publicUser>[0]) { return { token: signToken({ userId: user.id, role: user.role, employeeId: user.employee?.id }), user: publicUser(user) }; }

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError(401, "Current password is incorrect");
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: false } });
  await audit(userId, "UPDATE", "USER_PASSWORD", userId);
}

export const setupStatus = async () => ({ needsSetup: (await db.user.count({ where: { role: "ADMIN" } })) === 0 });
