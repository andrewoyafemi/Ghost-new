import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { User } from "../models";

// Token payload interface
export interface TokenPayload {
  id: number;
  email: string;
  plan: string;
}

/**
 * Generate an access token for a user
 * @param user User object or user ID
 * @returns JWT token
 */
export const generateAccessToken = (user: User | number): string => {
  const userId = typeof user === "number" ? user : user.id;
  const userEmail = typeof user === "number" ? "" : user.email;
  const userPlan = typeof user === "number" ? "basic" : user.plan;

  const payload: TokenPayload = {
    id: userId,
    email: userEmail,
    plan: userPlan,
  };

  const secret: Secret = process.env.JWT_SECRET || "your-secret-key";
  const options: SignOptions = {
    expiresIn:
      process.env.JWT_EXPIRY && !isNaN(Number(process.env.JWT_EXPIRY))
        ? Number(process.env.JWT_EXPIRY)
        : "1d",
  };

  return jwt.sign(payload, secret, options);
};

/**
 * Generate a refresh token for a user
 * @param user User object or user ID
 * @returns JWT refresh token
 */
export const generateRefreshToken = (user: User | number): string => {
  const userId = typeof user === "number" ? user : user.id;
  const userEmail = typeof user === "number" ? "" : user.email;
  const userPlan = typeof user === "number" ? "basic" : user.plan;

  const payload: TokenPayload = {
    id: userId,
    email: userEmail,
    plan: userPlan,
  };

  const secret: Secret = process.env.JWT_SECRET || "your-secret-key";
  const options: SignOptions = {
    expiresIn:
      process.env.JWT_REFRESH_EXPIRY &&
      !isNaN(Number(process.env.JWT_REFRESH_EXPIRY))
        ? Number(process.env.JWT_REFRESH_EXPIRY)
        : "7d",
  };

  return jwt.sign(payload, secret, options);
};

/**
 * Verify a JWT token
 * @param token JWT token to verify
 * @returns Decoded token payload
 */
export const verifyToken = (token: string): TokenPayload => {
  const secret: Secret = process.env.JWT_SECRET || "your-secret-key";
  return jwt.verify(token, secret) as TokenPayload;
};

/**
 * Create both an access and refresh token for a user
 * @param user User object
 * @returns Object with accessToken and refreshToken
 */
export const createTokens = (user: User) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
};
