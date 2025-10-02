import jwt from 'jsonwebtoken';

export const adminOnly = (req, res, next) => {
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
    req.admin = data;
    next();
  } catch (error) {
    console.error('Admin token verification failed:', error.message);
    return handleUnauthorized();
  }
};
