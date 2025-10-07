import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export const adminOnly = async (req, res, next) => {
  const token = req.cookies.admin_token;
  
  const handleUnauthorized = () => {
    // For API requests - always JSON error
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ message: 'Требуется авторизация администратора' });
    }
    // For pages - redirect to login
    return res.redirect('/login');
  };

  if (!token) {
    return handleUnauthorized();
  }
  
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    if (data.role !== 'admin') {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
      return res.redirect('/login');
    }
    // verify admin exists in DB
    const result = await pool.query('SELECT 1 FROM admins WHERE id = $1', [data.id]);
    if (result.rowCount === 0) {
      res.clearCookie('admin_token');
      return handleUnauthorized();
    }
    req.admin = data;
    next();
  } catch (error) {
    console.error('Admin token verification failed:', error.message);
    res.clearCookie('admin_token');
    return handleUnauthorized();
  }
};

export const trainerOnly = async (req, res, next) => {
  const token = req.cookies.token;
  
  const handleUnauthorized = () => {
    // For API requests - always JSON error
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ message: 'Требуется авторизация тренера' });
    }
    // For pages - redirect to login
    return res.redirect('/login');
  };

  if (!token) {
    return handleUnauthorized();
  }
  
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    if (data.role !== 'trainer') {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
      return res.redirect('/login');
    }
    // verify trainer exists in DB
    const result = await pool.query('SELECT 1 FROM trainers WHERE id = $1', [data.id]);
    if (result.rowCount === 0) {
      res.clearCookie('token');
      return handleUnauthorized();
    }
    req.user = data;
    next();
  } catch (error) {
    console.error('Trainer token verification failed:', error.message);
    res.clearCookie('token');
    return handleUnauthorized();
  }
};
