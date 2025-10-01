import jwt from 'jsonwebtoken';

export const adminOnly=(req,res,next)=>{
  const token=req.cookies.admin_token;
  if(!token) return res.sendStatus(401);
  try{
    const data=jwt.verify(token,process.env.JWT_SECRET);
    if(data.role!=='admin') return res.sendStatus(403);
    req.admin=data;
    next();
  }catch{res.sendStatus(401);}
};
