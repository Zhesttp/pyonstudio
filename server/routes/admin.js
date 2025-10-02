import { Router } from 'express';
import { pool } from '../db.js';
import { adminOnly } from '../middleware/admin.js';

const router = Router();

// GET /api/admin/clients – список клиентов с абонементом и статусом
router.get('/admin/clients', adminOnly, async (req, res) => {
  try {
    const client = await pool.connect();
    const q = `
      SELECT u.id,
             concat(u.last_name,' ',u.first_name)              AS full_name,
             u.email,
             u.phone,
             p.title                                          AS plan_title,
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
    client.release();
    res.json(rows);
  } catch (e) {
    console.error('admin/clients', e);
    res.sendStatus(500);
  }
});

export default router;
