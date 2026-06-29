import bcrypt from 'bcrypt';
import { z } from 'zod';
import { BadRequestError } from '../../../shared/errors/app-error.js';

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,}$/;

export const registerUserSchema = z.object({
  email: z.string().email('Invalid email address').min(1),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be 100 characters or less'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      PASSWORD_REGEX,
      'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character'
    ),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const refreshSchema = logoutSchema;

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

export interface User {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function assertPasswordMeetsComplexity(password: string): void {
  if (!PASSWORD_REGEX.test(password)) {
    throw new BadRequestError(
      'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one digit, and one special character'
    );
  }
}

export function createUser(input: RegisterUserInput, passwordHash: string): Omit<User, 'id'> {
  const now = new Date();
  return {
    email: normalizeEmail(input.email),
    displayName: input.displayName.trim(),
    passwordHash,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export type PublicUser = Pick<User, 'id' | 'email' | 'displayName'>;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}
