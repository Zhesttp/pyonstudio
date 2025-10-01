import jwt from 'jsonwebtoken';

export const auth = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    if (req.accepts('html')) return res.redirect('/login');
    return res.sendStatus(401);
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    if (req.accepts('html')) return res.redirect('/login');
    return res.sendStatus(401);
  }
};
