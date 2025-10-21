import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export const auth = async (req, res, next) => {
  const token = req.cookies.token;

  const handleUnauthorized = () => {
    // Для API запросов - всегда JSON ошибка
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ message: 'Требуется аутентификация' });
    }
    // Для страниц - редирект на логин
    return res.redirect('/login');
  };

  if (!token) {
    return handleUnauthorized();
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // verify user exists in DB (users or trainers)
    const [userRes] = await pool.query('SELECT 1 FROM users WHERE id = ?', [decoded.id]);
    const [trainerRes] = await pool.query('SELECT 1 FROM trainers WHERE id = ?', [decoded.id]);
    if (userRes.length === 0 && trainerRes.length === 0) {
      res.clearCookie('token');
      return handleUnauthorized();
    }
    req.user = decoded;
    next();
  } catch (e) {
    res.clearCookie('token');
    return handleUnauthorized();
  }
};
