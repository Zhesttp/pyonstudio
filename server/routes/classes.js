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
    client = await pool.getConnection();
    const q = `
      SELECT c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.duration_minutes, c.place,
             c.trainer_id, c.max_participants,
             CONCAT(t.first_name, ' ', t.last_name) AS trainer_name,
             c.type_id,
             ct.name AS type_name,
             COUNT(b.id) AS bookings_count,
             (c.max_participants - COUNT(b.id)) AS available_spots
      FROM classes c
      LEFT JOIN trainers t ON c.trainer_id = t.id
      LEFT JOIN class_types ct ON c.type_id = ct.id
      LEFT JOIN bookings b ON c.id = b.class_id AND b.status != 'cancelled'
      GROUP BY c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.duration_minutes, c.place, c.trainer_id, c.max_participants, t.first_name, t.last_name, c.type_id, ct.name
      ORDER BY c.class_date DESC, c.start_time
    `;
    const [rows] = await client.query(q);
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
  const { title, description, class_date, start_time, end_time, duration_minutes, place, trainer_id, type_id, max_participants } = req.body;
  
  if (!title || !class_date || !start_time || !end_time || !duration_minutes || !max_participants || !trainer_id) {
    return res.status(400).json({ message: 'Обязательные поля: название, дата, время начала, время конца, длительность, максимум участников и тренер' });
  }

  // Валидация данных
  if (max_participants < 1 || max_participants > 100) {
    return res.status(400).json({ message: 'Максимальное количество участников должно быть от 1 до 100' });
  }

  if (duration_minutes < 15 || duration_minutes > 300) {
    return res.status(400).json({ message: 'Длительность занятия должна быть от 15 до 300 минут' });
  }

  // Валидация UUID для trainer_id
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(trainer_id)) {
    return res.status(400).json({ message: 'Некорректный ID тренера' });
  }

  // Проверка даты (не в прошлом)
  const classDateTime = new Date(`${class_date}T${start_time}`);
  if (classDateTime < new Date()) {
    return res.status(400).json({ message: 'Нельзя создавать занятия в прошлом' });
  }

  let client;
  try {
    client = await pool.getConnection();
    const q = `
      INSERT INTO classes (title, description, class_date, start_time, end_time, duration_minutes, place, trainer_id, type_id, max_participants)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await client.query(q, [title, description, class_date, start_time, end_time, duration_minutes, place, trainer_id, type_id || null, max_participants]);
    const [idResult] = await client.query('SELECT LAST_INSERT_ID() as id');
    res.status(201).json({ id: idResult[0].id, message: 'Занятие успешно создано' });
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
  const { title, description, class_date, start_time, end_time, duration_minutes, place, trainer_id, type_id, max_participants } = req.body;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ message: 'Некорректный ID занятия' });
  }

  // Валидация данных
  if (max_participants && (max_participants < 1 || max_participants > 100)) {
    return res.status(400).json({ message: 'Максимальное количество участников должно быть от 1 до 100' });
  }

  if (duration_minutes && (duration_minutes < 15 || duration_minutes > 300)) {
    return res.status(400).json({ message: 'Длительность занятия должна быть от 15 до 300 минут' });
  }

  // Проверка даты (не в прошлом) если дата или время изменяются
  if (class_date && start_time) {
    const classDateTime = new Date(`${class_date}T${start_time}`);
    if (classDateTime < new Date()) {
      return res.status(400).json({ message: 'Нельзя переносить занятия в прошлое' });
    }
  }

  let client;
  try {
    client = await pool.getConnection();
    const q = `
      UPDATE classes 
      SET title = ?, description = ?, class_date = ?, start_time = ?, end_time = ?, 
          duration_minutes = ?, place = ?, trainer_id = ?, type_id = ?, max_participants = ?
      WHERE id = ?
    `;
    const result = await client.query(q, [title, description, class_date, start_time, end_time, duration_minutes, place, trainer_id || null, type_id || null, max_participants, id]);
    
    if (result[0].affectedRows === 0) {
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
    client = await pool.getConnection();
    const result = await client.query('DELETE FROM classes WHERE id = ?', [id]);
    
    if (result[0].affectedRows === 0) {
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
    client = await pool.getConnection();
    const q = `
      SELECT c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.place,
             c.type_id, c.max_participants,
             CONCAT(t.first_name, ' ', t.last_name) AS trainer_name,
             ct.name AS type_name,
             COUNT(b.id) AS bookings_count,
             (c.max_participants - COUNT(b.id)) AS available_spots,
             CASE WHEN ub.id IS NOT NULL THEN true ELSE false END AS user_booked
      FROM classes c
      LEFT JOIN trainers t ON c.trainer_id = t.id
      LEFT JOIN class_types ct ON c.type_id = ct.id
      LEFT JOIN bookings b ON c.id = b.class_id AND b.status != 'cancelled'
      LEFT JOIN bookings ub ON c.id = ub.class_id AND ub.user_id = ? AND ub.status != 'cancelled'
      WHERE c.class_date >= CURDATE()
      GROUP BY c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.place, c.type_id, c.max_participants, t.first_name, t.last_name, ct.name, ub.id
      ORDER BY c.class_date, c.start_time
    `;
    const [rows] = await client.query(q, [req.user.id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching classes for user:', error);
    res.status(500).json({ message: 'Ошибка загрузки расписания' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/schedule/week - расписание на текущую неделю (публичное)
router.get('/schedule/week', async (req, res) => {
  let client;
  try {
    client = await pool.getConnection();
    
    // Получаем начало и конец текущей недели (понедельник - воскресенье)
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Понедельник
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // Воскресенье
    
    const q = `
      SELECT c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.place,
             c.type_id, c.max_participants,
             CONCAT(t.first_name, ' ', t.last_name) AS trainer_name,
             ct.name AS type_name,
             COUNT(b.id) AS bookings_count,
             (c.max_participants - COUNT(b.id)) AS available_spots,
             false AS user_booked
      FROM classes c
      LEFT JOIN trainers t ON c.trainer_id = t.id
      LEFT JOIN class_types ct ON c.type_id = ct.id
      LEFT JOIN bookings b ON c.id = b.class_id AND b.status != 'cancelled'
      WHERE c.class_date >= ? AND c.class_date <= ?
      GROUP BY c.id, c.title, c.description, c.class_date, c.start_time, c.end_time, c.place, c.type_id, c.max_participants, t.first_name, t.last_name, ct.name
      ORDER BY c.class_date, c.start_time
    `;
    const [rows] = await client.query(q, [monday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching weekly schedule:', error);
    res.status(500).json({ message: 'Ошибка загрузки расписания на неделю' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/schedule/stats - статистика для расписания
router.get('/schedule/stats', async (req, res) => {
  let client;
  try {
    client = await pool.getConnection();
    
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
      WHERE c.class_date >= ? AND c.class_date <= ?
    `, [monday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]]);
    
    // Подсчитываем количество уникальных тренеров на неделе
    const trainersCount = await client.query(`
      SELECT COUNT(DISTINCT c.trainer_id) as count
      FROM classes c
      WHERE c.class_date >= ? AND c.class_date <= ? AND c.trainer_id IS NOT NULL
    `, [monday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]]);
    
    res.json({
      classes_count: parseInt(classesCount[0][0].count),
      trainers_count: parseInt(trainersCount[0][0].count)
    });
  } catch (error) {
    console.error('Error fetching schedule stats:', error);
    res.status(500).json({ message: 'Ошибка загрузки статистики расписания' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/schedule/types - типы занятий для фильтрации (публичное)
router.get('/schedule/types', async (req, res) => {
  let client;
  try {
    client = await pool.getConnection();
    
    // Получаем типы занятий, которые есть в расписании на текущую неделю
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const typesResult = await client.query(`
      SELECT DISTINCT ct.id, ct.name, ct.description
      FROM class_types ct
      INNER JOIN classes c ON ct.id = c.type_id
      WHERE c.class_date >= ? AND c.class_date <= ?
      ORDER BY ct.name
    `, [monday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]]);
    
    res.json(typesResult.rows);
  } catch (error) {
    console.error('Error fetching schedule types:', error);
    res.status(500).json({ message: 'Ошибка загрузки типов занятий' });
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
    client = await pool.getConnection();
    
    await client.query('START TRANSACTION');

    // Check if class exists and is in the future (with row locking)
    const classCheck = await client.query(`
      SELECT c.id, c.max_participants
      FROM classes c
      WHERE c.id = ? AND (c.class_date > CURDATE() OR (c.class_date = CURDATE() AND c.start_time > CURTIME()))
      FOR UPDATE
    `, [class_id]);
    
    if (classCheck[0].length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Занятие не найдено или уже прошло' });
    }

    const classInfo = classCheck[0][0];
    
    // Check current bookings count
    const bookingsCheck = await client.query(`
      SELECT COUNT(b.id) as current_bookings
      FROM bookings b
      WHERE b.class_id = ? AND b.status != 'cancelled'
    `, [class_id]);
    
    const currentBookings = parseInt(bookingsCheck[0][0].current_bookings);
    if (currentBookings >= classInfo.max_participants) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'На занятие уже записано максимальное количество участников' });
    }

    // Check for existing booking (any status)
    const existingAny = await client.query(`
      SELECT b.id, b.status,
             EXISTS (SELECT 1 FROM attendance a WHERE a.booking_id = b.id) AS has_attendance
      FROM bookings b
      WHERE b.user_id = ? AND b.class_id = ?
      FOR UPDATE
    `, [user_id, class_id]);
    
    if (existingAny[0].length > 0) {
      const existing = existingAny[0][0];
      if (existing.status !== 'cancelled') {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Вы уже записаны на это занятие' });
      }
      // If attendance exists for this booking, disallow re-booking
      if (existing.has_attendance) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Нельзя повторно записаться: по этой брони уже отмечена посещаемость' });
      }
    }

    // Check if user has active subscription
    const subscriptionCheck = await client.query(`
      SELECT us.id 
      FROM user_subscriptions us 
      WHERE us.user_id = ? AND us.end_date >= CURDATE()
      ORDER BY us.end_date DESC LIMIT 1
    `, [user_id]);
    
    if (subscriptionCheck[0].length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'У вас нет активного абонемента' });
    }

    // Create or revive booking
    let bookingId;
    if (existingAny[0].length === 0) {
      await client.query(`
        INSERT INTO bookings (user_id, class_id, status) VALUES (?, ?, 'booked')
      `, [user_id, class_id]);
      const bookingIns = await client.query('SELECT LAST_INSERT_ID() as id');
      bookingId = bookingIns[0][0].id;
    } else {
      await client.query(`
        UPDATE bookings SET status = 'booked', booked_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [existingAny[0][0].id]);
      bookingId = existingAny[0][0].id;
    }

    // Audit log: booking created
    await client.query(`
      INSERT INTO audit_log (actor_id, actor_type, action, table_name, row_id, new_data, ip)
      VALUES (?, 'user', 'book', 'bookings', ?, JSON_OBJECT('user_id',?,'class_id',?,'status','booked'), IFNULL(?,'0.0.0.0'))
    `, [user_id, bookingId, user_id, class_id, req.ip || null]);

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
    client = await pool.getConnection();
    
    await client.query('START TRANSACTION');

    // Find the booking and class timing; check attendance existence
    const bookingResult = await client.query(`
      SELECT b.id,
             c.class_date,
             c.start_time,
             EXISTS (
               SELECT 1 FROM attendance a WHERE a.booking_id = b.id
             ) AS has_attendance
      FROM bookings b
      JOIN classes c ON c.id = b.class_id
      WHERE b.user_id = ? AND b.class_id = ? AND b.status = 'booked'
    `, [user_id, class_id]);

    if (bookingResult[0].length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Запись на занятие не найдена' });
    }

    const booking = bookingResult[0][0];

    // Block cancellation if attendance already recorded
    if (booking.has_attendance) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Нельзя отменить: посещаемость уже отмечена тренером' });
    }

    // Block cancellation if class in past, or within 2 hours before start (including after start)
    const lockedResult = await client.query(
      `SELECT CASE 
         WHEN ? < CURDATE() THEN true
         WHEN ? = CURDATE() AND ? <= (CURTIME() + INTERVAL 8 HOUR) THEN true
         ELSE false
       END AS locked`,
      [booking.class_date, booking.class_date, booking.start_time]
    );
    if (lockedResult[0][0].locked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Нельзя отменить запись за 8 часов до начала или после старта' });
    }

    // Cancel the booking
    await client.query(`
      UPDATE bookings SET status = 'cancelled' WHERE id = ?
    `, [bookingResult[0][0].id]);

    // Audit log: cancellation
    await client.query(`
      INSERT INTO audit_log (actor_id, actor_type, action, table_name, row_id, old_data, new_data, ip)
      VALUES (?, 'user', 'cancel', 'bookings', ?, JSON_OBJECT('status','booked'), JSON_OBJECT('status','cancelled'), IFNULL(?,'0.0.0.0'))
    `, [user_id, bookingResult[0][0].id, req.ip || null]);

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
    client = await pool.getConnection();
    
    await client.query('START TRANSACTION');

    // Check if booking exists and load class timing and attendance
    const bookingCheck = await client.query(`
      SELECT b.id,
             c.class_date,
             c.start_time,
             EXISTS (
               SELECT 1 FROM attendance a WHERE a.booking_id = b.id
             ) AS has_attendance
      FROM bookings b
      JOIN classes c ON c.id = b.class_id
      WHERE b.user_id = ? AND b.class_id = ? AND b.status != 'cancelled'
    `, [user_id, class_id]);
    
    if (bookingCheck[0].length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Вы не записаны на это занятие' });
    }

    // Block cancellation if attendance already recorded
    if (bookingCheck[0][0].has_attendance) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Нельзя отменить: посещаемость уже отмечена тренером' });
    }

    // Block cancellation if class within 2 hours or started
    const lockedResult2 = await client.query(
      `SELECT CASE 
         WHEN ? < CURDATE() THEN true
         WHEN ? = CURDATE() AND ? <= (CURTIME() + INTERVAL 8 HOUR) THEN true
         ELSE false
       END AS locked`,
      [bookingCheck[0][0].class_date, bookingCheck[0][0].class_date, bookingCheck[0][0].start_time]
    );
    if (lockedResult2[0][0].locked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Нельзя отменить запись за 8 часов до начала или после старта' });
    }

    // Cancel booking
    await client.query(`
      UPDATE bookings 
      SET status = 'cancelled' 
      WHERE user_id = ? AND class_id = ? AND status != 'cancelled'
    `, [user_id, class_id]);

    // Audit log: cancellation
    await client.query(`
      INSERT INTO audit_log (actor_id, actor_type, action, table_name, row_id, old_data, new_data, ip)
      VALUES (?, 'user', 'cancel', 'bookings', ?, JSON_OBJECT('status','booked'), JSON_OBJECT('status','cancelled'), IFNULL(?,'0.0.0.0'))
    `, [user_id, bookingCheck[0][0].id, req.ip || null]);

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
