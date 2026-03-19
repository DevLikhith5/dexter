import { Router } from 'express';
import { getDashboardStats, getReports, getCalendarEvents } from '../controllers/statsController';
import { authenticateToken } from '../middleware/auth';

export const statsRoutes = Router();

statsRoutes.get('/dashboard', authenticateToken, getDashboardStats);
statsRoutes.get('/reports', authenticateToken, getReports);
statsRoutes.get('/calendar', authenticateToken, getCalendarEvents);
