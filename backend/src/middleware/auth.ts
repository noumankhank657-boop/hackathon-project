import type { RequestHandler } from "express";
import { db } from "../lib/db.js";
import { verifyToken, type TokenPayload } from "../lib/jwt.js";
import { AppError } from "./error-handler.js";

declare global { namespace Express { interface Request { auth?: TokenPayload } } }

export const requireAuth: RequestHandler = async (request, _response, next) => {
  try {
    const header = request.header("authorization");
    if (!header?.startsWith("Bearer ")) throw new AppError(401, "Authentication is required");
    const payload = verifyToken(header.slice(7));
    const user = await db.user.findUnique({ where: { id: payload.userId }, include: { employee: true } });
    if (!user || !user.isActive) throw new AppError(401, "Account is inactive or no longer exists");
    request.auth = { userId: user.id, role: user.role, employeeId: user.employee?.id };
    next();
  } catch (error) { next(error); }
};

export const requireRole = (...roles: TokenPayload["role"][]): RequestHandler => (request, _response, next) => {
  if (!request.auth) return next(new AppError(401, "Authentication is required"));
  if (!roles.includes(request.auth.role)) return next(new AppError(403, "You do not have permission for this action"));
  next();
};

export const requireEmployeeScope = (employeeId: string, auth?: TokenPayload) => {
  if (!auth) throw new AppError(401, "Authentication is required");
  if (auth.role === "EMPLOYEE" && auth.employeeId !== employeeId) throw new AppError(403, "You may only access your own records");
};
