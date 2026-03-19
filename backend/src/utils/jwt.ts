import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.JWT_SECRET || 'fallback_secret_for_development';

export const generateToken = (payload: object): string => {
  return jwt.sign(payload, secret, { expiresIn: '24h' });
};

export const generateRefreshToken = (payload: object): string => {
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid token');
  }
};