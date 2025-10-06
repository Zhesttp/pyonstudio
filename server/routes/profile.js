import { Router } from 'express';
import { pool } from '../db.js';
import { auth } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const router = Router();

router.get('/me', async (req, res, next) => {
  // Check admin token first
  if(req.cookies?.admin_token){
    try{
      const data=jwt.verify(req.cookies.admin_token,process.env.JWT_SECRET);
      if(data.role === 'admin') {
        return res.json({
          role: 'admin',
          email: data.email || 'admin',
          id: data.id
        });
      }
    }catch(error){
      console.error('Admin token verification failed:', error.message);
    }
  }
  
  // Check user token
  if(req.cookies?.token) {
    try{
      const data=jwt.verify(req.cookies.token,process.env.JWT_SECRET);
      if(data.role === 'user' || !data.role) { // backwards compatibility
        // Continue to user data fetching
        req.user = data;
        next();
        return;
      }
    }catch(error){
      console.error('User token verification failed:', error.message);
    }
  }
  
  // No valid tokens found
  return res.status(401).json({ message: 'Требуется авторизация' });
},async (req,res)=>{
  try {
    const client = await pool.connect();
    const q = `
        SELECT u.first_name, u.last_name, u.email, u.phone, u.birth_date, u.level,
               u.visits_count, u.minutes_practice,
               p.title AS plan_title,
               p.description AS plan_description,
               p.price AS plan_price,
               p.class_count AS total_classes,
               us.end_date AS plan_end_date,
               (
                  SELECT COUNT(*) 
                  FROM bookings b
                  JOIN classes c ON b.class_id = c.id
                  WHERE b.user_id = u.id 
                    AND b.status = 'attended' 
                    AND c.class_date >= us.start_date 
                    AND c.class_date <= us.end_date
               ) as attended_classes,
               CASE
                   WHEN us.end_date >= CURRENT_DATE THEN 'Активен'
                   ELSE 'Неактивен'
               END AS subscription_status
        FROM users u
        LEFT JOIN (
            SELECT *,
                   ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY end_date DESC) as rn
            FROM user_subscriptions
        ) us ON u.id = us.user_id AND us.rn = 1
        LEFT JOIN plans p ON us.plan_id = p.id
        WHERE u.id = $1;
    `;
    const userPromise = client.query(q, [req.user.id]);

    // Запрос 2: Все существующие достижения
    const allAchievementsPromise = client.query('SELECT id, code, title, description, icon FROM achievements');

    // Запрос 3: Достижения текущего пользователя
    const userAchievementsPromise = client.query('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [req.user.id]);
    
    const [userRes, allAchievementsRes, userAchievementsRes] = await Promise.all([
        userPromise,
        allAchievementsPromise,
        userAchievementsPromise
    ]);

    client.release();

    if (!userRes.rowCount) return res.sendStatus(404);

    const userProfile = userRes.rows[0];
    userProfile.all_achievements = allAchievementsRes.rows;
    userProfile.unlocked_achievement_ids = userAchievementsRes.rows.map(r => r.achievement_id);

    res.json(userProfile);
  } catch (e) {
    console.error('me error', e);
    res.sendStatus(500);
  }
});

router.put('/me', auth, async (req, res) => {
    const { first_name, last_name, email, phone, birth_date, level } = req.body;
    const userId = req.user.id;

    if (!first_name || !last_name || !email) {
        return res.status(400).json({ message: 'Имя, фамилия и email обязательны' });
    }

    try {
        const client = await pool.connect();
        await client.query(
            `UPDATE users 
             SET first_name=$1, last_name=$2, email=$3, phone=$4, birth_date=$5, level=$6
             WHERE id=$7`,
            [first_name, last_name, email, phone, birth_date, level, userId]
        );
        client.release();
        res.sendStatus(204); // Успех, нет контента
    } catch (e) {
        console.error('Ошибка обновления профиля:', e);
        if (e.code === '23505') { // unique_violation
            return res.status(409).json({ message: 'Этот email уже используется' });
        }
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

export default router;

// === DASHBOARD: Upcoming booked classes for current user ===
router.get('/me/upcoming-classes', auth, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const q = `
      SELECT c.id,
             c.title,
             c.class_date,
             c.start_time,
             c.end_time,
             c.place,
             t.first_name || ' ' || t.last_name AS trainer_name
      FROM bookings b
      JOIN classes c ON c.id = b.class_id
      LEFT JOIN trainers t ON c.trainer_id = t.id
      WHERE b.user_id = $1
        AND b.status = 'booked'
        AND (c.class_date > CURRENT_DATE OR (c.class_date = CURRENT_DATE AND c.start_time >= CURRENT_TIME))
      ORDER BY c.class_date ASC, c.start_time ASC
      LIMIT 5
    `;
    const { rows } = await client.query(q, [req.user.id]);
    res.json(rows);
  } catch (e) {
    console.error('Error fetching upcoming classes:', e);
    res.status(500).json({ message: 'Ошибка загрузки ближайших занятий' });
  } finally {
    if (client) client.release();
  }
});
