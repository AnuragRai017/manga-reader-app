import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { User, UserResponse } from '../types/user';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: UserResponse): string {
  return jwt.sign(
    { 
      _id: user._id,
      email: user.email,
      username: user.username 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): UserResponse {
  try {
    return jwt.verify(token, JWT_SECRET) as UserResponse;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function sanitizeUser(user: User): UserResponse {
  const { password, ...sanitizedUser } = user;
  return sanitizedUser as UserResponse;
} 