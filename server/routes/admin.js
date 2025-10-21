import { Router } from 'express';
import { pool } from '../db.js';
import { adminOnly } from '../middleware/admin.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройка multer для загрузки фото тренеров
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../trainers');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `trainer-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены'), false);
    }
  }
});

const router = Router();

// GET /api/admin/clients – список клиентов с абонементом и статусом
router.get('/admin/clients', adminOnly, async (req, res) => {
  let client;
  try {
    client = await pool.getConnection();
    const q = `
      SELECT u.id,
             concat(u.last_name,' ',u.first_name) AS full_name,
             u.email,
             u.phone,
             u.is_quick_registration,
             u.account_number,
             p.title AS plan_title,
             CASE WHEN us.end_date >= CURDATE() THEN 'Активен' ELSE 'Неактивен' END AS status
      FROM users u
      LEFT JOIN (
        SELECT us2.*, ROW_NUMBER() OVER(PARTITION BY us2.user_id ORDER BY us2.end_date DESC) as rn
        FROM user_subscriptions us2
      ) us ON u.id = us.user_id AND us.rn = 1
      LEFT JOIN plans p ON p.id = us.plan_id
      ORDER BY full_name;
    `;
    const [rows] = await client.query(q);
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
    client = await pool.getConnection();
    const q = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.birth_date,
             u.is_quick_registration, u.account_number,
             p.title AS plan_title, us.end_date,
             (CASE WHEN us.end_date >= CURDATE() THEN 'Активен' ELSE 'Неактивен' END) AS sub_status
      FROM users u
      LEFT JOIN user_subscriptions us ON us.user_id = u.id
      LEFT JOIN plans p ON p.id = us.plan_id
      WHERE u.id = ?
      ORDER BY us.end_date DESC NULLS LAST LIMIT 1
    `;
    const [rows] = await client.query(q, [id]);
    
    if (rows.length === 0) {
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
    const { first_name, last_name, email, phone, birth_date } = req.body;

    // Валидация обязательных полей
    if (!first_name || !last_name || !email) {
        return res.status(400).json({ message: 'Имя, фамилия и email обязательны' });
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Некорректный формат email' });
    }

    // Валидация телефона (если предоставлен)
    if (phone && !/^[\+]?[0-9\s\-\(\)]{10,}$/.test(phone)) {
        return res.status(400).json({ message: 'Некорректный формат телефона' });
    }

    // Валидация UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
        return res.status(400).json({ message: 'Некорректный ID клиента' });
    }

    let client;
    try {
        client = await pool.getConnection();
        
        // Проверяем, существует ли клиент
        const checkResult = await client.query('SELECT id, email FROM users WHERE id = ?', [id]);
        if (checkResult[0].length === 0) {
            return res.status(404).json({ message: 'Клиент не найден' });
        }

        const existingUser = checkResult[0][0];
        
        // Проверяем уникальность email (если изменился)
        if (existingUser.email !== email) {
            const emailCheckResult = await client.query(
                'SELECT id, first_name, last_name FROM users WHERE email = ? AND id != ?', 
                [email, id]
            );
            if (emailCheckResult[0].length > 0) {
                const existingClient = emailCheckResult[0][0];
                return res.status(400).json({ 
                    message: `Email уже используется клиентом: ${existingClient.first_name} ${existingClient.last_name}` 
                });
            }
        }

        // Обновляем данные клиента
        await client.query(
            `UPDATE users SET 
                first_name = ?, 
                last_name = ?, 
                email = ?, 
                phone = ?, 
                birth_date = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [first_name, last_name, email, phone, birth_date, id]
        );
        
        console.log(`Клиент ${id} обновлен админом:`, { first_name, last_name, email, phone, birth_date });
        res.sendStatus(204); // Успех, нет контента
        
    } catch (e) {
        console.error('Ошибка обновления клиента:', e);
        if (e.code === 'ER_DUP_ENTRY') { // MySQL duplicate entry
            res.status(400).json({ message: 'Email уже используется' });
        } else {
            res.status(500).json({ message: 'Внутренняя ошибка сервера' });
        }
    } finally {
        if (client) client.release();
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
        client = await pool.getConnection();
        
        const userCheck = await client.query('SELECT id FROM users WHERE id = ?', [user_id]);
        if (userCheck[0].length === 0) {
            return res.status(404).json({ message: 'Клиент не найден' });
        }

        const planRes = await client.query('SELECT duration_days, class_count, title FROM plans WHERE id = ?', [plan_id]);
        if (planRes[0].length === 0) {
            return res.status(404).json({ message: 'Абонемент не найден' });
        }
        
        const { duration_days, class_count, title } = planRes[0][0];

        await client.query('START TRANSACTION');
        
        // Deactivate any currently active subscriptions for this user
        await client.query(`
            UPDATE user_subscriptions 
            SET end_date = CURDATE() - INTERVAL 1 DAY
            WHERE user_id = ? AND end_date >= CURDATE()
        `, [user_id]);

        // Use UPSERT (INSERT ... ON CONFLICT) to handle potential duplicates
        const insertResult = await client.query(`
            INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date)
            VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY))
            ON DUPLICATE KEY UPDATE 
                end_date = DATE_ADD(CURDATE(), INTERVAL ? DAY)
        `, [user_id, plan_id, duration_days, duration_days]);

        await client.query('COMMIT');
        
        // Get the inserted subscription data
        const [subscriptionResult] = await client.query(`
            SELECT id, start_date, end_date FROM user_subscriptions 
            WHERE user_id = ? AND plan_id = ? AND start_date = CURDATE()
        `, [user_id, plan_id]);
        const subscription = subscriptionResult[0];
        
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
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('unique_subscription')) {
            res.status(409).json({ message: 'Этот абонемент уже назначен клиенту на сегодняшнюю дату' });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
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
    client = await pool.getConnection();
    const result = await client.query('DELETE FROM users WHERE id = ?', [id]);
    
    if (result[0].affectedRows === 0) {
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
    client = await pool.getConnection();
    const q = `
      SELECT t.id, t.first_name, t.last_name, t.birth_date, t.photo_url, t.bio, t.created_at,
             t.email,
             COUNT(c.id) as classes_count
      FROM trainers t
      LEFT JOIN classes c ON t.id = c.trainer_id
      GROUP BY t.id, t.first_name, t.last_name, t.birth_date, t.photo_url, t.bio, t.created_at
      ORDER BY t.created_at DESC
    `;
    const [rows] = await client.query(q);
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
  const { first_name, last_name, birth_date, photo_url, bio, email, password } = req.body;
  
  if (!first_name || !last_name) {
    return res.status(400).json({ message: 'Имя и фамилия обязательны' });
  }

  let client;
  try {
    client = await pool.getConnection();
    let passwordHash = null;
    if (password) {
      const bcrypt = (await import('bcrypt')).default;
      passwordHash = await bcrypt.hash(password, 12);
    }
    const q = `
      INSERT INTO trainers (first_name, last_name, birth_date, photo_url, bio, email, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await client.query(q, [first_name, last_name, birth_date || null, photo_url || null, bio || null, email || null, passwordHash]);
    const [idResult] = await client.query('SELECT LAST_INSERT_ID() as id');
    res.status(201).json({ 
      id: idResult[0].id, 
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
    client = await pool.getConnection();
    const q = `
      SELECT t.id, t.first_name, t.last_name, t.birth_date, t.photo_url, t.bio, t.created_at,
             t.email,
             COUNT(c.id) as classes_count
      FROM trainers t
      LEFT JOIN classes c ON t.id = c.trainer_id
      WHERE t.id = ?
      GROUP BY t.id, t.first_name, t.last_name, t.birth_date, t.photo_url, t.bio, t.created_at
    `;
    const [rows] = await client.query(q, [id]);
    
    if (rows.length === 0) {
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
  const { first_name, last_name, birth_date, photo_url, bio, email, password } = req.body;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ message: 'Некорректный ID тренера' });
  }

  if (!first_name || !last_name) {
    return res.status(400).json({ message: 'Имя и фамилия обязательны' });
  }

  let client;
  try {
    client = await pool.getConnection();
    
    // Get current photo_url before update
    const currentResult = await client.query('SELECT photo_url FROM trainers WHERE id = ?', [id]);
    if (currentResult[0].length === 0) {
      return res.status(404).json({ message: 'Тренер не найден' });
    }
    
    const currentPhotoUrl = currentResult[0][0].photo_url;
    
    let passwordHashSet = '';
    const params = [first_name, last_name, birth_date || null, photo_url || null, bio || null, email || null];
    if (password) {
      const bcrypt = (await import('bcrypt')).default;
      const ph = await bcrypt.hash(password, 12);
      passwordHashSet = ', password_hash = ?';
      params.push(id); // placeholder will adjust below
      // We'll push password hash before id to match placeholders
    }
    let q = `UPDATE trainers 
             SET first_name = ?, last_name = ?, birth_date = ?, photo_url = ?, bio = ?, email = ?`;
    if (password) {
      q += `, password_hash = ? WHERE id = ?`;
    } else {
      q += ` WHERE id = ?`;
    }
    const finalParams = password ? [first_name, last_name, birth_date || null, photo_url || null, bio || null, email || null, ph, id] : [first_name, last_name, birth_date || null, photo_url || null, bio || null, email || null, id];
    const result = await client.query(q, finalParams);
    
    if (result[0].affectedRows === 0) {
      return res.status(404).json({ message: 'Тренер не найден' });
    }
    
    // Delete old photo file if it exists and is different from new one
    if (currentPhotoUrl && currentPhotoUrl !== photo_url && currentPhotoUrl.startsWith('/trainers/')) {
      const oldPhotoPath = path.join(__dirname, '../../', currentPhotoUrl);
      if (fs.existsSync(oldPhotoPath)) {
        try {
          fs.unlinkSync(oldPhotoPath);
          console.log(`Deleted old photo: ${oldPhotoPath}`);
        } catch (fileError) {
          console.error('Error deleting old photo file:', fileError);
        }
      }
    }
    
    // If photo_url is null and there was a photo before, log the deletion
    if (!photo_url && currentPhotoUrl) {
      console.log(`Photo removed for trainer ${id}`);
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
    client = await pool.getConnection();
    
    // Check if trainer has any classes assigned
    const classCheck = await client.query('SELECT COUNT(*) as count FROM classes WHERE trainer_id = ?', [id]);
    const classesCount = parseInt(classCheck[0][0].count);
    
    if (classesCount > 0) {
      return res.status(409).json({ 
        message: `Нельзя удалить тренера, у которого есть ${classesCount} назначенных занятий. Сначала переназначьте или удалите занятия.` 
      });
    }
    
    // Get trainer photo_url before deletion
    const trainerResult = await client.query('SELECT photo_url FROM trainers WHERE id = ?', [id]);
    if (trainerResult[0].length === 0) {
      return res.status(404).json({ message: 'Тренер не найден' });
    }
    
    const photoUrl = trainerResult[0][0].photo_url;
    
    // Delete trainer from database
    const result = await client.query('DELETE FROM trainers WHERE id = ?', [id]);
    
    // Delete photo file if exists
    if (photoUrl && photoUrl.startsWith('/trainers/')) {
      const photoPath = path.join(__dirname, '../../', photoUrl);
      if (fs.existsSync(photoPath)) {
        try {
          fs.unlinkSync(photoPath);
        } catch (fileError) {
          console.error('Error deleting photo file:', fileError);
        }
      }
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting trainer:', error);
    res.status(500).json({ message: 'Ошибка удаления тренера' });
  } finally {
    if (client) client.release();
  }
});

// POST /api/admin/trainers/upload-photo - загрузить фото тренера
router.post('/admin/trainers/upload-photo', adminOnly, upload.single('photo'), async (req, res) => {
  let client;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не был загружен' });
    }

    const { trainer_id } = req.body;
    if (!trainer_id) {
      return res.status(400).json({ message: 'ID тренера обязателен' });
    }

    // Verify file was actually saved
    const filePath = path.join(__dirname, '../../trainers', req.file.filename);
    if (!fs.existsSync(filePath)) {
      console.error('Uploaded file not found:', filePath);
      return res.status(500).json({ message: 'Ошибка сохранения файла' });
    }

    const photoUrl = `/trainers/${req.file.filename}`;
    
    // Update trainer with photo URL
    client = await pool.getConnection();
    await client.query('UPDATE trainers SET photo_url = ? WHERE id = ?', [photoUrl, trainer_id]);
    client.release();
    
    console.log(`Photo uploaded successfully: ${photoUrl}`);
    res.json({ photo_url: photoUrl });
  } catch (error) {
    console.error('Error uploading photo:', error);
    
    if (client) client.release();
    
    // Clean up failed upload if file exists
    if (req.file) {
      const filePath = path.join(__dirname, '../../trainers', req.file.filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          console.error('Error cleaning up failed upload:', cleanupError);
        }
      }
    }
    
    res.status(500).json({ message: 'Ошибка загрузки фото' });
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
    client = await pool.getConnection();
    
    // Check if user has active subscription
    const subscriptionCheck = await client.query(`
      SELECT id FROM user_subscriptions 
      WHERE user_id = ? AND end_date >= CURDATE()
    `, [user_id]);
    
    if (subscriptionCheck[0].length === 0) {
      return res.status(404).json({ message: 'У клиента нет активного абонемента' });
    }
    
    await client.query('START TRANSACTION');
    
    // Cancel all active subscriptions for this user
    await client.query(`
      UPDATE user_subscriptions 
      SET end_date = CURDATE() - INTERVAL 1 DAY
      WHERE user_id = ? AND end_date >= CURDATE()
    `, [user_id]);
    
    // Also cancel any future bookings for this user
    await client.query(`
      UPDATE bookings 
      SET status = 'cancelled'
      WHERE user_id = ? 
        AND class_id IN (
          SELECT c.id FROM classes c 
          WHERE c.class_date >= CURDATE()
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

// GET /api/admin/class-types - список всех типов занятий
router.get('/admin/class-types', adminOnly, async (req, res) => {
    let client;
    try {
        client = await pool.getConnection();
        const q = 'SELECT id, name, description FROM class_types ORDER BY name';
        const [rows] = await client.query(q);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching class types:', error);
        res.status(500).json({ message: 'Ошибка загрузки типов занятий' });
    } finally {
        if (client) client.release();
    }
});

// POST /api/admin/class-types - создать новый тип занятия
router.post('/admin/class-types', adminOnly, async (req, res) => {
    const { name, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ message: 'Название типа обязательно' });
    }

    let client;
    try {
        client = await pool.getConnection();
        const q = `
            INSERT INTO class_types (name, description)
            VALUES (?, ?)
        `;
        await client.query(q, [name, description || null]);
        const [idResult] = await client.query('SELECT LAST_INSERT_ID() as id');
        res.status(201).json({ id: idResult[0].id, message: 'Тип занятия создан' });
    } catch (error) {
        console.error('Error creating class type:', error);
        if (error.code === 'ER_DUP_ENTRY') { // MySQL duplicate entry
            res.status(400).json({ message: 'Тип занятия с таким названием уже существует' });
        } else {
            res.status(500).json({ message: 'Ошибка создания типа занятия' });
        }
    } finally {
        if (client) client.release();
    }
});

export default router;
