import { Router } from 'express';
import { pool } from '../db.js';
import { auth } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const router = Router();

router.get('/me', async (req, res, next) => {
  console.log('Profile request - cookies:', req.cookies);
  
  // Check admin token first
  if(req.cookies?.admin_token){
    try{
      const data=jwt.verify(req.cookies.admin_token,process.env.JWT_SECRET);
      console.log('Admin token verified:', data);
      if(data.role === 'admin') {
        // Get admin details from database
        const client = await pool.getConnection();
        try {
          const adminResult = await client.query('SELECT name, email FROM admins WHERE id = ?', [data.id]);
          if (adminResult[0].length > 0) {
            const admin = adminResult[0][0];
            // Split name into first and last name
            const nameParts = admin.name.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            return res.json({
              role: 'admin',
              first_name: firstName,
              last_name: lastName,
              email: admin.email,
              id: data.id
            });
          }
        } finally {
          client.release();
        }
        return res.json({
          role: 'admin',
          email: data.email || 'admin',
          id: data.id
        });
      }
    }catch(error){
      console.error('Admin token verification failed:', error.message);
      res.clearCookie('admin_token');
    }
  }
  
  // Check user/trainer token if no admin token
  if(req.cookies?.token) {
    try{
      const data=jwt.verify(req.cookies.token,process.env.JWT_SECRET);
      console.log('User/trainer token verified:', data);
      if(data.role === 'user' || data.role === 'trainer' || !data.role) { // backwards compatibility
        // Continue to user/trainer data fetching
        req.user = data;
        next();
        return;
      }
    }catch(error){
      console.error('User/trainer token verification failed:', error.message);
      res.clearCookie('token');
    }
  }
  
  // No valid tokens found
  console.log('No valid tokens found');
  return res.status(401).json({ message: 'Требуется авторизация' });
});

// This route handler is called after the first middleware
router.get('/me', async (req,res)=>{
  try {
    console.log('Fetching profile for user:', req.user);
    const client = await pool.getConnection();
    
    // Handle trainer profile
    if (req.user.role === 'trainer') {
      const q = `
        SELECT first_name, last_name, email, birth_date, photo_url, bio
        FROM trainers
        WHERE id = ?;
      `;
      const [result] = await client.query(q, [req.user.id]);
      client.release();
      
      if (result.length === 0) return res.sendStatus(404);
      
      return res.json(result[0]);
    }
    
    // Handle user profile (existing logic)
    const q = `
        SELECT u.first_name, u.last_name, u.email, u.phone, u.birth_date,
               u.visits_count, u.minutes_practice, u.is_quick_registration, u.account_number,
               p.title AS plan_title,
               p.description AS plan_description,
               p.price AS plan_price,
               p.class_count AS total_classes,
               us.end_date AS plan_end_date,
               (
                  SELECT COUNT(*) 
                  FROM bookings b
                  JOIN classes c ON b.class_id = c.id
                  JOIN attendance a ON b.id = a.booking_id
                  WHERE b.user_id = u.id 
                    AND a.status = 'attended' 
                    AND c.class_date >= us.start_date 
                    AND c.class_date <= us.end_date
               ) as attended_classes,
               CASE
                   WHEN us.end_date >= CURDATE() THEN 'Активен'
                   ELSE 'Неактивен'
               END AS subscription_status
        FROM users u
        LEFT JOIN (
            SELECT *,
                   ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY end_date DESC) as rn
            FROM user_subscriptions
            WHERE end_date >= CURDATE()
        ) us ON u.id = us.user_id AND us.rn = 1
        LEFT JOIN plans p ON us.plan_id = p.id
        WHERE u.id = ?;
    `;
    const userPromise = client.query(q, [req.user.id]);

    // Запрос 2: Все существующие достижения
    const allAchievementsPromise = client.query('SELECT id, code, title, description, icon FROM achievements');

    // Запрос 3: Достижения текущего пользователя
    const userAchievementsPromise = client.query('SELECT achievement_id FROM user_achievements WHERE user_id = ?', [req.user.id]);
    
    const [userRes, allAchievementsRes, userAchievementsRes] = await Promise.all([
        userPromise,
        allAchievementsPromise,
        userAchievementsPromise
    ]);

    client.release();

    if (userRes[0].length === 0) return res.sendStatus(404);

    const userProfile = userRes[0][0];
    userProfile.all_achievements = allAchievementsRes[0];
    userProfile.unlocked_achievement_ids = userAchievementsRes[0].map(r => r.achievement_id);

    console.log('Profile data fetched successfully:', userProfile);
    res.json(userProfile);
  } catch (e) {
    console.error('Profile fetch error:', e);
    res.status(500).json({ 
      message: 'Ошибка загрузки профиля',
      error: process.env.NODE_ENV === 'development' ? e.message : undefined
    });
  }
});

router.put('/me', auth, async (req, res) => {
    const { first_name, last_name, email, phone, birth_date } = req.body;
    const userId = req.user.id;

    if (!first_name || !last_name || !email) {
        return res.status(400).json({ message: 'Имя, фамилия и email обязательны' });
    }

    try {
        const client = await pool.getConnection();
        await client.query(
            `UPDATE users 
             SET first_name=?, last_name=?, email=?, phone=?, birth_date=?
             WHERE id=?`,
            [first_name, last_name, email, phone, birth_date, userId]
        );
        client.release();
        res.sendStatus(204); // Успех, нет контента
    } catch (e) {
        console.error('Ошибка обновления профиля:', e);
        if (e.code === 'ER_DUP_ENTRY') { // MySQL duplicate entry
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
    client = await pool.getConnection();
    const q = `
      SELECT c.id,
             c.title,
             c.class_date,
             c.start_time,
             c.end_time,
             c.place,
             CONCAT(t.first_name, ' ', t.last_name) AS trainer_name
      FROM bookings b
      JOIN classes c ON c.id = b.class_id
      LEFT JOIN trainers t ON c.trainer_id = t.id
      WHERE b.user_id = ?
        AND b.status = 'booked'
        AND (c.class_date > CURDATE() OR (c.class_date = CURDATE() AND c.start_time >= CURTIME()))
      ORDER BY c.class_date ASC, c.start_time ASC
      LIMIT 5
    `;
    const [rows] = await client.query(q, [req.user.id]);
    res.json(rows);
  } catch (e) {
    console.error('Error fetching upcoming classes:', e);
    res.status(500).json({ message: 'Ошибка загрузки ближайших занятий' });
  } finally {
    if (client) client.release();
  }
});
