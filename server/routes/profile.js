import { Router } from 'express';
import { pool } from '../db.js';
import { auth } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const router = Router();

router.get('/me', async (req, res, next) => {
  // if admin token present return minimal info
  if(req.cookies?.admin_token){
    try{
      const data=jwt.verify(req.cookies.admin_token,process.env.JWT_SECRET);
      return res.json({role:'admin',email:'admin'});
    }catch{/* fallthrough to auth */}
  }
  auth(req,res,next);
},async (req,res)=>{
  try {
    const client = await pool.connect();
    const r = await client.query('SELECT first_name,last_name,email,phone,birth_date,level FROM users WHERE id=$1', [req.user.id]);
    client.release();
    if (!r.rowCount) return res.sendStatus(404);
    res.json(r.rows[0]);
  } catch (e) {
    console.error('me error', e);
    res.sendStatus(500);
  }
});

export default router;
