import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/wishlister-test'),
  JWT_ACCESS_SECRET: z.string().min(1).default('test-access-secret'),
  JWT_REFRESH_SECRET: z.string().min(1).default('test-refresh-secret'),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  AWS_S3_BUCKET_NAME: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_PUBLIC_URL_PREFIX: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
}

export const config = parsed.data;
