import { z } from "zod";
export const setupSchema = z.object({ body: z.object({ companyName: z.string().trim().min(2).max(100), email: z.string().email(), password: z.string().min(8).max(128) }) });
export const loginSchema = z.object({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) });
export const passwordSchema = z.object({ body: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) }) });
