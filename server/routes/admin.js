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

// GET details
router.get('/admin/clients/:id', adminOnly, async (req,res)=>{
  const {id}=req.params;
  try{
    const client=await pool.connect();
    const q=`SELECT u.id, u.first_name,u.last_name,u.email,u.phone,u.birth_date,u.level, p.title AS plan_title, us.end_date,
            (CASE WHEN us.end_date>=CURRENT_DATE THEN 'Активен' ELSE 'Неактивен' END) AS sub_status
            FROM users u
            LEFT JOIN user_subscriptions us ON us.user_id=u.id
            LEFT JOIN plans p ON p.id=us.plan_id
            WHERE u.id=$1
            ORDER BY us.end_date DESC NULLS LAST LIMIT 1`;
    const {rows}=await client.query(q,[id]);client.release();
    if(!rows.length) return res.sendStatus(404);res.json(rows[0]);
  }catch(e){console.error('client detail',e);res.sendStatus(500);} });

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

    // Более строгая проверка: id должен быть похож на UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!plan_id || !user_id || !uuidRegex.test(user_id)) {
        return res.status(400).json({ message: 'Некорректный ID клиента или абонемента' });
    }

    let client;
    try {
        client = await pool.connect();
        const planRes = await client.query('SELECT duration_days FROM plans WHERE id=$1', [plan_id]);

        if (planRes.rowCount === 0) {
            client.release();
            return res.status(404).json({ message: 'Абонемент не найден' });
        }
        const duration = planRes.rows[0].duration_days;

        // Ищем существующую подписку, чтобы обновить ее или создать новую.
        // ON CONFLICT (user_id) требует уникального индекса ТОЛЬКО по user_id. 
        // Если его нет, придется делать SELECT+INSERT/UPDATE.
        // Допустим, мы просто удаляем старые и вставляем новую для простоты.
        await client.query('BEGIN');
        await client.query('DELETE FROM user_subscriptions WHERE user_id = $1', [user_id]);
        await client.query(
            `INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date)
             VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + ($3 * INTERVAL '1 day'))`,
            [user_id, plan_id, duration]
        );
        await client.query('COMMIT');

        client.release();
        res.status(201).json({ message: 'Абонемент успешно назначен' });
    } catch (e) {
        if (client) {
            await client.query('ROLLBACK');
            client.release();
        }
        console.error('Ошибка назначения абонемента:', e);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

// DELETE /api/admin/clients/:id – remove client
router.delete('/admin/clients/:id', adminOnly, async (req,res)=>{
  const {id}=req.params;
  try{
    const client=await pool.connect();
    await client.query('DELETE FROM users WHERE id=$1',[id]);
    client.release();
    res.sendStatus(204);
  }catch(e){console.error('del client',e);res.sendStatus(500);} 
});

export default router;
