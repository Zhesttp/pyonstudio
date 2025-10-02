import jwt from 'jsonwebtoken';

export const auth = (req, res, next) => {
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
    req.user = decoded;
    next();
  } catch (e) {
    return handleUnauthorized();
  }
};
