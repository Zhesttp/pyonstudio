import { Router } from 'express';
import { pool } from '../db.js';
import { adminOnly } from '../middleware/admin.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// === ADMIN ENDPOINTS ===

// GET /api/admin/classes - список всех занятий
router.get('/admin/classes', adminOnly, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const q = `
      SELECT c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.duration_minutes, c.place,
             c.trainer_id,
             t.first_name || ' ' || t.last_name AS trainer_name,
             c.type_id,
             ct.name AS type_name,
             COUNT(b.id) AS bookings_count
      FROM classes c
      LEFT JOIN trainers t ON c.trainer_id = t.id
      LEFT JOIN class_types ct ON c.type_id = ct.id
      LEFT JOIN bookings b ON c.id = b.class_id AND b.status != 'cancelled'
      GROUP BY c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.duration_minutes, c.place, c.trainer_id, t.first_name, t.last_name, c.type_id, ct.name
      ORDER BY c.class_date DESC, c.start_time
    `;
    const { rows } = await client.query(q);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Ошибка загрузки списка занятий' });
  } finally {
    if (client) client.release();
  }
});

// POST /api/admin/classes - создать новое занятие
router.post('/admin/classes', adminOnly, async (req, res) => {
  const { title, description, class_date, start_time, end_time, duration_minutes, place, trainer_id, type_id } = req.body;
  
  if (!title || !class_date || !start_time || !end_time || !duration_minutes) {
    return res.status(400).json({ message: 'Обязательные поля: название, дата, время начала, время конца и длительность' });
  }

  let client;
  try {
    client = await pool.connect();
    const q = `
      INSERT INTO classes (title, description, class_date, start_time, end_time, duration_minutes, place, trainer_id, type_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    const { rows } = await client.query(q, [title, description, class_date, start_time, end_time, duration_minutes, place, trainer_id || null, type_id || null]);
    res.status(201).json({ id: rows[0].id, message: 'Занятие успешно создано' });
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ message: 'Ошибка создания занятия' });
  } finally {
    if (client) client.release();
  }
});

// PUT /api/admin/classes/:id - обновить занятие
router.put('/admin/classes/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { title, description, class_date, start_time, end_time, duration_minutes, place, trainer_id, type_id } = req.body;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ message: 'Некорректный ID занятия' });
  }

  let client;
  try {
    client = await pool.connect();
    const q = `
      UPDATE classes 
      SET title = $1, description = $2, class_date = $3, start_time = $4, end_time = $5, 
          duration_minutes = $6, place = $7, trainer_id = $8, type_id = $9
      WHERE id = $10
    `;
    const result = await client.query(q, [title, description, class_date, start_time, end_time, duration_minutes, place, trainer_id || null, type_id || null, id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Занятие не найдено' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ message: 'Ошибка обновления занятия' });
  } finally {
    if (client) client.release();
  }
});

// DELETE /api/admin/classes/:id - удалить занятие
router.delete('/admin/classes/:id', adminOnly, async (req, res) => {
  const { id } = req.params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ message: 'Некорректный ID занятия' });
  }

  let client;
  try {
    client = await pool.connect();
    const result = await client.query('DELETE FROM classes WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Занятие не найдено' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ message: 'Ошибка удаления занятия' });
  } finally {
    if (client) client.release();
  }
});

// === USER ENDPOINTS ===

// GET /api/classes - список доступных занятий для пользователей
router.get('/classes', auth, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const q = `
      SELECT c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.place,
             t.first_name || ' ' || t.last_name AS trainer_name,
             ct.name AS type_name,
             COUNT(b.id) AS bookings_count,
             CASE WHEN ub.id IS NOT NULL THEN true ELSE false END AS user_booked
      FROM classes c
      LEFT JOIN trainers t ON c.trainer_id = t.id
      LEFT JOIN class_types ct ON c.type_id = ct.id
      LEFT JOIN bookings b ON c.id = b.class_id AND b.status != 'cancelled'
      LEFT JOIN bookings ub ON c.id = ub.class_id AND ub.user_id = $1 AND ub.status != 'cancelled'
      WHERE c.class_date >= CURRENT_DATE
      GROUP BY c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.place, t.first_name, t.last_name, ct.name, ub.id
      ORDER BY c.class_date, c.start_time
    `;
    const { rows } = await client.query(q, [req.user.id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching classes for user:', error);
    res.status(500).json({ message: 'Ошибка загрузки расписания' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/schedule/week - расписание на текущую неделю
router.get('/schedule/week', auth, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    // Получаем начало и конец текущей недели (понедельник - воскресенье)
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Понедельник
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // Воскресенье
    
    const q = `
      SELECT c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.place,
             t.first_name || ' ' || t.last_name AS trainer_name,
             ct.name AS type_name,
             COUNT(b.id) AS bookings_count,
             CASE WHEN ub.id IS NOT NULL THEN true ELSE false END AS user_booked
      FROM classes c
      LEFT JOIN trainers t ON c.trainer_id = t.id
      LEFT JOIN class_types ct ON c.type_id = ct.id
      LEFT JOIN bookings b ON c.id = b.class_id AND b.status != 'cancelled'
      LEFT JOIN bookings ub ON c.id = ub.class_id AND ub.user_id = $1 AND ub.status != 'cancelled'
      WHERE c.class_date >= $2 AND c.class_date <= $3
      GROUP BY c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.place, t.first_name, t.last_name, ct.name, ub.id
      ORDER BY c.class_date, c.start_time
    `;
    const { rows } = await client.query(q, [req.user.id, monday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching weekly schedule:', error);
    res.status(500).json({ message: 'Ошибка загрузки расписания на неделю' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/schedule/stats - статистика для расписания
router.get('/schedule/stats', auth, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    // Получаем начало и конец текущей недели
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    // Подсчитываем количество занятий на неделе
    const classesCount = await client.query(`
      SELECT COUNT(*) as count
      FROM classes c
      WHERE c.class_date >= $1 AND c.class_date <= $2
    `, [monday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]]);
    
    // Подсчитываем количество уникальных тренеров на неделе
    const trainersCount = await client.query(`
      SELECT COUNT(DISTINCT c.trainer_id) as count
      FROM classes c
      WHERE c.class_date >= $1 AND c.class_date <= $2 AND c.trainer_id IS NOT NULL
    `, [monday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]]);
    
    res.json({
      classes_count: parseInt(classesCount.rows[0].count),
      trainers_count: parseInt(trainersCount.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching schedule stats:', error);
    res.status(500).json({ message: 'Ошибка загрузки статистики расписания' });
  } finally {
    if (client) client.release();
  }
});

// POST /api/classes/:id/book - забронировать занятие
router.post('/classes/:id/book', auth, async (req, res) => {
  const { id: class_id } = req.params;
  const user_id = req.user.id;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(class_id)) {
    return res.status(400).json({ message: 'Некорректный ID занятия' });
  }

  let client;
  try {
    client = await pool.connect();
    
    await client.query('BEGIN');

    // Check if class exists and is in the future
    const classCheck = await client.query(`
      SELECT id FROM classes 
      WHERE id = $1 AND (class_date > CURRENT_DATE OR (class_date = CURRENT_DATE AND start_time > CURRENT_TIME))
    `, [class_id]);
    
    if (classCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Занятие не найдено или уже прошло' });
    }

    // Check if user already booked this class
    const existingBooking = await client.query(`
      SELECT id FROM bookings WHERE user_id = $1 AND class_id = $2 AND status != 'cancelled'
    `, [user_id, class_id]);
    
    if (existingBooking.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Вы уже записаны на это занятие' });
    }

    // Check if user has active subscription
    const subscriptionCheck = await client.query(`
      SELECT us.id 
      FROM user_subscriptions us 
      WHERE us.user_id = $1 AND us.end_date >= CURRENT_DATE
      ORDER BY us.end_date DESC LIMIT 1
    `, [user_id]);
    
    if (subscriptionCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'У вас нет активного абонемента' });
    }

    // Create booking
    await client.query(`
      INSERT INTO bookings (user_id, class_id, status) VALUES ($1, $2, 'booked')
    `, [user_id, class_id]);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Запись на занятие прошла успешно' });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error booking class:', error);
    res.status(500).json({ message: 'Ошибка записи на занятие' });
  } finally {
    if (client) client.release();
  }
});

// DELETE /api/classes/:id/cancel - отменить запись на занятие
router.delete('/classes/:id/cancel', auth, async (req, res) => {
  const { id: class_id } = req.params;
  const user_id = req.user.id;

  let client;
  try {
    client = await pool.connect();
    
    await client.query('BEGIN');

    // Find the booking
    const bookingResult = await client.query(`
      SELECT b.id
      FROM bookings b
      WHERE b.user_id = $1 AND b.class_id = $2 AND b.status = 'booked'
    `, [user_id, class_id]);

    if (bookingResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Запись на занятие не найдена' });
    }

    // Cancel the booking
    await client.query(`
      UPDATE bookings SET status = 'cancelled' WHERE id = $1
    `, [bookingResult.rows[0].id]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Запись на занятие отменена' });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error cancelling booking:', error);
    res.status(500).json({ message: 'Ошибка отмены записи' });
  } finally {
    if (client) client.release();
  }
});

// DELETE /api/classes/:id/book - отписаться от занятия (альтернативный путь)
router.delete('/classes/:id/book', auth, async (req, res) => {
  const { id: class_id } = req.params;
  const user_id = req.user.id;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(class_id)) {
    return res.status(400).json({ message: 'Некорректный ID занятия' });
  }

  let client;
  try {
    client = await pool.connect();
    
    await client.query('BEGIN');

    // Check if booking exists
    const bookingCheck = await client.query(`
      SELECT id FROM bookings 
      WHERE user_id = $1 AND class_id = $2 AND status != 'cancelled'
    `, [user_id, class_id]);
    
    if (bookingCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Вы не записаны на это занятие' });
    }

    // Cancel booking
    await client.query(`
      UPDATE bookings 
      SET status = 'cancelled' 
      WHERE user_id = $1 AND class_id = $2 AND status != 'cancelled'
    `, [user_id, class_id]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Вы успешно отписались от занятия' });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }
    res.status(500).json({ message: 'Ошибка отписки от занятия' });
  } finally {
    if (client) client.release();
  }
});

export default router;
