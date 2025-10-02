import { Router } from 'express';
import { pool } from '../db.js';
import { adminOnly } from '../middleware/admin.js';

const router=Router();

router.get('/admin/plans',adminOnly,async(req,res)=>{
  try{
    const client=await pool.connect();
    const {rows}=await client.query('SELECT id,title,description,price,duration_days,class_count FROM plans ORDER BY created_at');
    client.release();
    res.json(rows);
  }catch(e){console.error('plans list',e);res.sendStatus(500);}
});

router.post('/admin/plans',adminOnly,async(req,res)=>{
  const {title,description,price,duration_days,class_count}=req.body;
  if(!title||!price||!duration_days) return res.sendStatus(400);
  try{
    const client=await pool.connect();
    const {rows}=await client.query('INSERT INTO plans(title,description,price,duration_days,class_count) VALUES($1,$2,$3,$4,$5) RETURNING id',[title,description,price,duration_days,class_count]);
    client.release();
    res.status(201).json({id:rows[0].id});
  }catch(e){console.error('plan create',e);res.sendStatus(500);}
});

router.put('/admin/plans/:id',adminOnly,async(req,res)=>{
  const {id}=req.params;
  const {title,description,price,duration_days,class_count}=req.body;
  try{
    const client=await pool.connect();
    await client.query('UPDATE plans SET title=$1,description=$2,price=$3,duration_days=$4,class_count=$5 WHERE id=$6',[title,description,price,duration_days,class_count,id]);
    client.release();
    res.sendStatus(204);
  }catch(e){console.error('plan update',e);res.sendStatus(500);} 
});

router.delete('/admin/plans/:id',adminOnly,async(req,res)=>{
  const {id}=req.params;
  try{
    const client=await pool.connect();
    await client.query('DELETE FROM plans WHERE id=$1',[id]);
    client.release();
    res.sendStatus(204);
  }catch(e){console.error('plan del',e);res.sendStatus(500);} 
});

export default router;
