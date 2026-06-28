import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { config } from '../config/config.js';

export interface TokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function generateAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
  });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('base64url');
}

export async function hashRefreshToken(token: string): Promise<string> {
  return bcrypt.hash(token, 12);
}

export async function verifyRefreshTokenHash(token: string, tokenHash: string): Promise<boolean> {
  return bcrypt.compare(token, tokenHash);
}

export async function compareRefreshTokenHash(token: string, tokenHash: string): Promise<boolean> {
  return bcrypt.compare(token, tokenHash);
}

export function generateAuthTokens(userId: string): AuthTokens {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000);

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiresAt,
  };
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as TokenPayload;
}
