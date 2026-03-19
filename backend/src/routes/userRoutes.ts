import { Router } from 'express';
import { createUser, loginUser, getCurrentUser, logoutUser, refreshUserToken, updateProfile, updateAvatar } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

export const userRoutes = Router();

userRoutes.post('/register', createUser);
userRoutes.post('/login', loginUser);
userRoutes.post('/logout', authenticateToken, logoutUser);
userRoutes.post('/refresh', refreshUserToken);
userRoutes.get('/me', authenticateToken, getCurrentUser);
userRoutes.put('/me', authenticateToken, updateProfile);
userRoutes.post('/me/avatar', authenticateToken, updateAvatar);