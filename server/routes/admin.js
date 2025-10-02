import { Router } from 'express';
import { pool } from '../db.js';
import { adminOnly } from '../middleware/admin.js';

const router = Router();

// GET /api/admin/clients – список клиентов с абонементом и статусом
router.get('/admin/clients', adminOnly, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const q = `
      SELECT u.id,
             concat(u.last_name,' ',u.first_name) AS full_name,
             u.email,
             u.phone,
             p.title AS plan_title,
             CASE WHEN us.end_date >= CURRENT_DATE THEN 'Активен' ELSE 'Неактивен' END AS status
      FROM users u
      LEFT JOIN LATERAL (
        SELECT *
        FROM user_subscriptions us2
        WHERE us2.user_id = u.id
        ORDER BY us2.end_date DESC
        LIMIT 1
      ) us ON true
      LEFT JOIN plans p ON p.id = us.plan_id
      ORDER BY full_name;
    `;
    const { rows } = await client.query(q);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching clients list:', error);
    res.status(500).json({ message: 'Ошибка загрузки списка клиентов' });
  } finally {
    if (client) client.release();
  }
});

// GET details
router.get('/admin/clients/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ message: 'Некорректный ID клиента' });
  }

  let client;
  try {
    client = await pool.connect();
    const q = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.birth_date, u.level,
             p.title AS plan_title, us.end_date,
             (CASE WHEN us.end_date >= CURRENT_DATE THEN 'Активен' ELSE 'Неактивен' END) AS sub_status
      FROM users u
      LEFT JOIN user_subscriptions us ON us.user_id = u.id
      LEFT JOIN plans p ON p.id = us.plan_id
      WHERE u.id = $1
      ORDER BY us.end_date DESC NULLS LAST LIMIT 1
    `;
    const { rows } = await client.query(q, [id]);
    
    if (!rows.length) {
      return res.status(404).json({ message: 'Клиент не найден' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching client details:', error);
    res.status(500).json({ message: 'Ошибка загрузки данных клиента' });
  } finally {
    if (client) client.release();
  }
});

// PUT /api/admin/clients/:id – обновить данные клиента
router.put('/admin/clients/:id', adminOnly, async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, email, phone, birth_date, level } = req.body;

    if (!first_name || !last_name || !email) {
        return res.status(400).json({ message: 'Имя, фамилия и email обязательны' });
    }

    try {
        const client = await pool.connect();
        await client.query(
            `UPDATE users SET first_name=$1, last_name=$2, email=$3, phone=$4, birth_date=$5, level=$6
             WHERE id=$7`,
            [first_name, last_name, email, phone, birth_date, level, id]
        );
        client.release();
        res.sendStatus(204); // Успех, нет контента
    } catch (e) {
        console.error('Ошибка обновления клиента:', e);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

// POST /api/admin/clients/:id/subscription – назначить/обновить абонемент
router.post('/admin/clients/:id/subscription', adminOnly, async (req, res) => {
    const { plan_id } = req.body;
    const { id: user_id } = req.params;

    // Validate UUID format for both user_id and plan_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!plan_id || !user_id || !uuidRegex.test(user_id) || !uuidRegex.test(plan_id)) {
        return res.status(400).json({ message: 'Некорректный ID клиента или абонемента' });
    }

    let client;
    try {
        client = await pool.connect();
        
        const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [user_id]);
        if (userCheck.rowCount === 0) {
            return res.status(404).json({ message: 'Клиент не найден' });
        }

        const planRes = await client.query('SELECT duration_days, class_count, title FROM plans WHERE id = $1', [plan_id]);
        if (planRes.rowCount === 0) {
            return res.status(404).json({ message: 'Абонемент не найден' });
        }
        
        const { duration_days, class_count, title } = planRes.rows[0];

        await client.query('BEGIN');
        
        // Deactivate any currently active subscriptions for this user
        await client.query(`
            UPDATE user_subscriptions 
            SET end_date = CURRENT_DATE - INTERVAL '1 day'
            WHERE user_id = $1 AND end_date >= CURRENT_DATE
        `, [user_id]);

        // Use UPSERT (INSERT ... ON CONFLICT) to handle potential duplicates
        const insertResult = await client.query(`
            INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date)
            VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + ($3 * INTERVAL '1 day'))
            ON CONFLICT (user_id, plan_id, start_date) 
            DO UPDATE SET 
                end_date = CURRENT_DATE + ($3 * INTERVAL '1 day')
            RETURNING id, start_date, end_date
        `, [user_id, plan_id, duration_days]);

        await client.query('COMMIT');
        
        const subscription = insertResult.rows[0];
        
        res.status(201).json({ 
            message: 'Абонемент успешно назначен',
            details: {
                subscription_id: subscription.id,
                plan_title: title,
                duration_days,
                class_count: class_count || 'Безлимит',
                start_date: subscription.start_date.toISOString().split('T')[0],
                end_date: subscription.end_date.toISOString().split('T')[0]
            }
        });

    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }
        console.error('Error assigning subscription:', error);
        
        // More specific error handling
        if (error.code === '23505' && error.constraint === 'user_subscriptions_user_id_plan_id_start_date_key') {
            res.status(409).json({ message: 'Этот абонемент уже назначен клиенту на сегодняшнюю дату' });
        } else if (error.code === '23503') {
            res.status(400).json({ message: 'Некорректные данные клиента или абонемента' });
        } else {
            res.status(500).json({ message: 'Ошибка назначения абонемента' });
        }
    } finally {
        if (client) client.release();
    }
});

// DELETE /api/admin/clients/:id – remove client
router.delete('/admin/clients/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ message: 'Некорректный ID клиента' });
  }

  let client;
  try {
    client = await pool.connect();
    const result = await client.query('DELETE FROM users WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Клиент не найден' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Ошибка удаления клиента' });
  } finally {
    if (client) client.release();
  }
});

// === TRAINERS ENDPOINTS ===

// GET /api/admin/trainers - список всех тренеров
router.get('/admin/trainers', adminOnly, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const q = `
      SELECT t.id, t.first_name, t.last_name, t.birth_date, t.photo_url, t.bio, t.created_at,
             COUNT(c.id) as classes_count
      FROM trainers t
      LEFT JOIN classes c ON t.id = c.trainer_id
      GROUP BY t.id, t.first_name, t.last_name, t.birth_date, t.photo_url, t.bio, t.created_at
      ORDER BY t.created_at DESC
    `;
    const { rows } = await client.query(q);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching trainers:', error);
    res.status(500).json({ message: 'Ошибка загрузки списка тренеров' });
  } finally {
    if (client) client.release();
  }
});

// POST /api/admin/trainers - создать нового тренера
router.post('/admin/trainers', adminOnly, async (req, res) => {
  const { first_name, last_name, birth_date, photo_url, bio } = req.body;
  
  if (!first_name || !last_name) {
    return res.status(400).json({ message: 'Имя и фамилия обязательны' });
  }

  let client;
  try {
    client = await pool.connect();
    const q = `
      INSERT INTO trainers (first_name, last_name, birth_date, photo_url, bio)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const { rows } = await client.query(q, [first_name, last_name, birth_date || null, photo_url || null, bio || null]);
    res.status(201).json({ 
      id: rows[0].id, 
      message: 'Тренер успешно добавлен'
    });
  } catch (error) {
    console.error('Error creating trainer:', error);
    res.status(500).json({ message: 'Ошибка создания тренера' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/admin/trainers/:id - получить данные тренера
router.get('/admin/trainers/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ message: 'Некорректный ID тренера' });
  }

  let client;
  try {
    client = await pool.connect();
    const q = `
      SELECT t.id, t.first_name, t.last_name, t.birth_date, t.photo_url, t.bio, t.created_at,
             COUNT(c.id) as classes_count
      FROM trainers t
      LEFT JOIN classes c ON t.id = c.trainer_id
      WHERE t.id = $1
      GROUP BY t.id, t.first_name, t.last_name, t.birth_date, t.photo_url, t.bio, t.created_at
    `;
    const { rows } = await client.query(q, [id]);
    
    if (!rows.length) {
      return res.status(404).json({ message: 'Тренер не найден' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching trainer details:', error);
    res.status(500).json({ message: 'Ошибка загрузки данных тренера' });
  } finally {
    if (client) client.release();
  }
});

// PUT /api/admin/trainers/:id - обновить данные тренера
router.put('/admin/trainers/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, birth_date, photo_url, bio } = req.body;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ message: 'Некорректный ID тренера' });
  }

  if (!first_name || !last_name) {
    return res.status(400).json({ message: 'Имя и фамилия обязательны' });
  }

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      UPDATE trainers 
      SET first_name = $1, last_name = $2, birth_date = $3, photo_url = $4, bio = $5
      WHERE id = $6
    `, [first_name, last_name, birth_date || null, photo_url || null, bio || null, id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Тренер не найден' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error updating trainer:', error);
    res.status(500).json({ message: 'Ошибка обновления данных тренера' });
  } finally {
    if (client) client.release();
  }
});

// DELETE /api/admin/trainers/:id - удалить тренера
router.delete('/admin/trainers/:id', adminOnly, async (req, res) => {
  const { id } = req.params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ message: 'Некорректный ID тренера' });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Check if trainer has any classes assigned
    const classCheck = await client.query('SELECT COUNT(*) as count FROM classes WHERE trainer_id = $1', [id]);
    const classesCount = parseInt(classCheck.rows[0].count);
    
    if (classesCount > 0) {
      return res.status(409).json({ 
        message: `Нельзя удалить тренера, у которого есть ${classesCount} назначенных занятий. Сначала переназначьте или удалите занятия.` 
      });
    }
    
    const result = await client.query('DELETE FROM trainers WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Тренер не найден' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting trainer:', error);
    res.status(500).json({ message: 'Ошибка удаления тренера' });
  } finally {
    if (client) client.release();
  }
});

// DELETE /api/admin/clients/:id/subscription - удалить абонемент у клиента
router.delete('/admin/clients/:id/subscription', adminOnly, async (req, res) => {
  const { id: user_id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(user_id)) {
    return res.status(400).json({ message: 'Некорректный ID клиента' });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Check if user has active subscription
    const subscriptionCheck = await client.query(`
      SELECT id FROM user_subscriptions 
      WHERE user_id = $1 AND end_date >= CURRENT_DATE
    `, [user_id]);
    
    if (subscriptionCheck.rowCount === 0) {
      return res.status(404).json({ message: 'У клиента нет активного абонемента' });
    }
    
    await client.query('BEGIN');
    
    // Cancel all active subscriptions for this user
    await client.query(`
      UPDATE user_subscriptions 
      SET end_date = CURRENT_DATE - INTERVAL '1 day'
      WHERE user_id = $1 AND end_date >= CURRENT_DATE
    `, [user_id]);
    
    // Also cancel any future bookings for this user
    await client.query(`
      UPDATE bookings 
      SET status = 'cancelled'
      WHERE user_id = $1 
        AND class_id IN (
          SELECT c.id FROM classes c 
          WHERE c.class_date >= CURRENT_DATE
        )
        AND status = 'booked'
    `, [user_id]);
    
    await client.query('COMMIT');
    res.status(200).json({ message: 'Абонемент успешно удален' });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error deleting subscription:', error);
    res.status(500).json({ message: 'Ошибка удаления абонемента' });
  } finally {
    if (client) client.release();
  }
});

export default router;
