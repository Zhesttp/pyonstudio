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
    const [result] = await pool.query('SELECT 1 FROM admins WHERE id = ?', [data.id]);
    if (result.length === 0) {
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
  
  console.log('Trainer auth check:', {
    url: req.originalUrl,
    hasToken: !!token,
    cookies: req.cookies
  });
  
  const handleUnauthorized = () => {
    // For API requests - always JSON error
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ message: 'Требуется авторизация тренера' });
    }
    // For pages - redirect to login
    return res.redirect('/login');
  };

  if (!token) {
    console.log('No token found for trainer request');
    return handleUnauthorized();
  }
  
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified:', { role: data.role, id: data.id });
    
    if (data.role !== 'trainer') {
      console.log('Role mismatch:', { expected: 'trainer', actual: data.role });
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
      return res.redirect('/login');
    }
    // verify trainer exists in DB
    const [result] = await pool.query('SELECT 1 FROM trainers WHERE id = ?', [data.id]);
    if (result.length === 0) {
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
