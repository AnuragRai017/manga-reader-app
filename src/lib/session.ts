import type { APIRoute } from 'astro';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface Session {
  userId: string;
  role: string;
}

export const getSession = async (request: Request): Promise<Session | null> => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Session;
    return decoded;
  } catch (error) {
    return null;
  }
};