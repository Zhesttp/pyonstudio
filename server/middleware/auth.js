import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export const auth = async (req, res, next) => {
  const userToken = req.cookies.token;
  const trainerToken = req.cookies.trainer_token;

  const handleUnauthorized = () => {
    // Для API запросов - всегда JSON ошибка
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ message: 'Требуется аутентификация' });
    }
    // Для страниц - редирект на логин
    return res.redirect('/login');
  };

  // Try user token first
  if (userToken) {
    try {
      const decoded = jwt.verify(userToken, process.env.JWT_SECRET);
      if (decoded.role === 'user' || !decoded.role) {
        // verify user exists in DB
        const [userRes] = await pool.query('SELECT 1 FROM users WHERE id = ?', [decoded.id]);
        if (userRes.length > 0) {
          req.user = decoded;
          return next();
        }
      }
    } catch (e) {
      res.clearCookie('token');
    }
  }
  
  // Try trainer token
  if (trainerToken) {
    try {
      const decoded = jwt.verify(trainerToken, process.env.JWT_SECRET);
      if (decoded.role === 'trainer') {
        // verify trainer exists in DB
        const [trainerRes] = await pool.query('SELECT 1 FROM trainers WHERE id = ?', [decoded.id]);
        if (trainerRes.length > 0) {
          req.user = decoded;
          return next();
        }
      }
    } catch (e) {
      res.clearCookie('trainer_token');
    }
  }
  
  return handleUnauthorized();
};
