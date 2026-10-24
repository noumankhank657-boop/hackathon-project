import jwt from "jsonwebtoken";
import { AppError } from "../middleware/error-handler.js";

export type TokenPayload = { userId: string; role: "ADMIN" | "HR" | "EMPLOYEE"; employeeId?: string };

const secret = () => {
  if (!process.env.JWT_SECRET) throw new AppError(500, "JWT_SECRET is not configured");
  return process.env.JWT_SECRET;
};

export const signToken = (payload: TokenPayload) => jwt.sign(payload, secret(), { expiresIn: "8h" });
export const verifyToken = (token: string) => jwt.verify(token, secret()) as TokenPayload;
