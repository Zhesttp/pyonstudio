import { Router } from 'express';
import { pool } from '../db.js';
import { adminOnly } from '../middleware/admin.js';

const router=Router();

router.get('/admin/plans',adminOnly,async(req,res)=>{
  try{
    const client=await pool.getConnection();
    const [rows]=await client.query('SELECT id,title,description,price,duration_days,class_count FROM plans ORDER BY created_at');
    client.release();
    res.json(rows);
  }catch(e){console.error('plans list',e);res.sendStatus(500);}
});

router.post('/admin/plans',adminOnly,async(req,res)=>{
  const {title,description,price,duration_days,class_count}=req.body;
  
  // Improved validation
  if(!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({message: 'Название абонемента обязательно'});
  }
  if(!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    return res.status(400).json({message: 'Цена должна быть положительным числом'});
  }
  if(!duration_days || isNaN(parseInt(duration_days)) || parseInt(duration_days) <= 0) {
    return res.status(400).json({message: 'Длительность должна быть положительным числом дней'});
  }
  if(class_count !== null && class_count !== undefined && (isNaN(parseInt(class_count)) || parseInt(class_count) < 0)) {
    return res.status(400).json({message: 'Количество занятий должно быть положительным числом или пустым'});
  }
  
  let client;
  try{
    client = await pool.getConnection();
    await client.query(
      'INSERT INTO plans(title,description,price,duration_days,class_count) VALUES(?,?,?,?,?)',
      [title.trim(), description?.trim() || null, parseFloat(price), parseInt(duration_days), class_count ? parseInt(class_count) : null]
    );
    const [idResult] = await client.query('SELECT LAST_INSERT_ID() as id');
    res.status(201).json({id:idResult[0].id, message: 'Абонемент успешно создан'});
  }catch(e){
    console.error('Error creating plan:', e);
    if(e.code === 'ER_DUP_ENTRY') {
      res.status(409).json({message: 'Абонемент с таким названием уже существует'});
    } else {
      res.status(500).json({message: 'Ошибка создания абонемента'});
    }
  } finally {
    if(client) client.release();
  }
});

router.put('/admin/plans/:id',adminOnly,async(req,res)=>{
  const {id}=req.params;
  const {title,description,price,duration_days,class_count}=req.body;
  
  // Validate UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({message: 'Некорректный ID абонемента'});
  }

  // Improved validation (same as POST)
  if(!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({message: 'Название абонемента обязательно'});
  }
  if(!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    return res.status(400).json({message: 'Цена должна быть положительным числом'});
  }
  if(!duration_days || isNaN(parseInt(duration_days)) || parseInt(duration_days) <= 0) {
    return res.status(400).json({message: 'Длительность должна быть положительным числом дней'});
  }
  if(class_count !== null && class_count !== undefined && (isNaN(parseInt(class_count)) || parseInt(class_count) < 0)) {
    return res.status(400).json({message: 'Количество занятий должно быть положительным числом или пустым'});
  }
  
  let client;
  try{
    client = await pool.getConnection();
    const result = await client.query(
      'UPDATE plans SET title=?,description=?,price=?,duration_days=?,class_count=? WHERE id=?',
      [title.trim(), description?.trim() || null, parseFloat(price), parseInt(duration_days), class_count ? parseInt(class_count) : null, id]
    );
    
    if (result[0].affectedRows === 0) {
      return res.status(404).json({message: 'Абонемент не найден'});
    }
    
    res.status(200).json({message: 'Абонемент успешно обновлен'});
  }catch(e){
    console.error('Error updating plan:', e);
    if(e.code === 'ER_DUP_ENTRY') {
      res.status(409).json({message: 'Абонемент с таким названием уже существует'});
    } else {
      res.status(500).json({message: 'Ошибка обновления абонемента'});
    }
  } finally {
    if(client) client.release();
  }
});

router.delete('/admin/plans/:id',adminOnly,async(req,res)=>{
  const {id}=req.params;
  
  // Validate UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({message: 'Некорректный ID абонемента'});
  }
  
  let client;
  try{
    client = await pool.getConnection();
    
    // Check if plan is used in active subscriptions
    const subscriptionsCheck = await client.query(
      'SELECT COUNT(*) as count FROM user_subscriptions WHERE plan_id = ? AND end_date >= CURDATE()',
      [id]
    );
    
    const activeSubscriptions = parseInt(subscriptionsCheck[0][0].count);
    if (activeSubscriptions > 0) {
      return res.status(409).json({
        message: `Нельзя удалить абонемент, который используется в ${activeSubscriptions} активных подписках`
      });
    }
    
    const result = await client.query('DELETE FROM plans WHERE id=?',[id]);
    
    if (result[0].affectedRows === 0) {
      return res.status(404).json({message: 'Абонемент не найден'});
    }
    
    res.status(200).json({message: 'Абонемент успешно удален'});
  }catch(e){
    console.error('Error deleting plan:', e);
    if(e.code === 'ER_NO_REFERENCED_ROW_2') {
      res.status(409).json({message: 'Нельзя удалить абонемент, который используется в системе'});
    } else {
      res.status(500).json({message: 'Ошибка удаления абонемента'});
    }
  } finally {
    if(client) client.release();
  }
});

export default router;
