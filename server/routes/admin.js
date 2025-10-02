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
             CASE WHEN us.end_date >= CURRENT_DATE AND us.is_active = TRUE THEN 'Активен' ELSE 'Неактивен' END AS status
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
             p.title AS plan_title, us.end_date, us.remaining_classes,
             (CASE WHEN us.end_date >= CURRENT_DATE AND us.is_active = TRUE THEN 'Активен' ELSE 'Неактивен' END) AS sub_status
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
        
        // Check if user exists
        const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [user_id]);
        if (userCheck.rowCount === 0) {
            return res.status(404).json({ message: 'Клиент не найден' });
        }

        // Check if plan exists and get its details
        const planRes = await client.query('SELECT duration_days, class_count FROM plans WHERE id = $1', [plan_id]);
        if (planRes.rowCount === 0) {
            return res.status(404).json({ message: 'Абонемент не найден' });
        }
        
        const { duration_days, class_count } = planRes.rows[0];

        await client.query('BEGIN');
        
        // Instead of deleting all subscriptions, properly handle active ones
        // First, mark any currently active subscriptions as ended
        await client.query(`
            UPDATE user_subscriptions 
            SET end_date = CURRENT_DATE - INTERVAL '1 day', is_active = FALSE
            WHERE user_id = $1 AND end_date >= CURRENT_DATE AND is_active = TRUE
        `, [user_id]);

        // Insert new subscription with remaining classes
        await client.query(`
            INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, remaining_classes, is_active)
            VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + ($3 * INTERVAL '1 day'), $4, TRUE)
        `, [user_id, plan_id, duration_days, class_count]);

        await client.query('COMMIT');
        res.status(201).json({ 
            message: 'Абонемент успешно назначен',
            details: {
                duration_days,
                class_count: class_count || 'Безлимит',
                start_date: new Date().toISOString().split('T')[0]
            }
        });

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error assigning subscription:', error);
        res.status(500).json({ message: 'Ошибка назначения абонемента' });
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

export default router;
