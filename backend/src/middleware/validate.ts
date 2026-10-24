import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export const validate = (schema: ZodType): RequestHandler => (request, _response, next) => {
  try {
    const parsed = schema.parse({
      body: request.body,
      params: request.params,
      query: request.query,
    });
    request.body = parsed.body;
    next();
  } catch (error) {
    next(error);
  }
};
