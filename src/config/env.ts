import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),
  DEV_OTP_ENABLED: z.coerce.boolean().default(false),
  DEV_OTP_FIXED_CODE: z.string().regex(/^\d{6}$/).optional(),
  CORS_ORIGINS: z.string().default("*"),
  SOFTAGGREGATOR_BASE_URL: z.string().url().default("https://api.softaggregator.com/api/v1"),
  SOFTAGGREGATOR_API_LOGIN: z.string().optional(),
  SOFTAGGREGATOR_API_PASSWORD: z.string().optional(),
  SOFTAGGREGATOR_SALT_KEY: z.string().optional(),
  SOFTAGGREGATOR_PLAYER_SECRET: z.string().min(32).optional(),
  SOFTAGGREGATOR_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  SOFTAGGREGATOR_ENABLED: z.coerce.boolean().default(false),
});

export const env = schema.parse(process.env);
export const corsOrigins = env.CORS_ORIGINS === "*"
  ? true
  : env.CORS_ORIGINS.split(",").map(x => x.trim()).filter(Boolean);
