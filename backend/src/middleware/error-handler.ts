import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: "Invalid request data", details: error.flatten() });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      response.status(409).json({ error: "Record already exists" });
      return;
    }

    if (error.code === "P2025") {
      response.status(404).json({ error: "Record not found" });
      return;
    }
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "An unexpected error occurred" });
};
