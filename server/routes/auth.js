import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = Router();

// Validation rules
const phoneRegex = /^\+375\d{9}$/;
const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const registerValidation = [
  body('first_name').isAlpha('ru-RU', {ignore: ' '}).withMessage('Имя должно содержать только буквы').isLength({ min: 2, max: 30 }).withMessage('Имя должно быть от 2 до 30 символов'),
  body('last_name').isAlpha('ru-RU', {ignore: ' '}).withMessage('Фамилия должна содержать только буквы').isLength({ min: 2, max: 30 }).withMessage('Фамилия должна быть от 2 до 30 символов'),
  body('phone').matches(phoneRegex).withMessage('Телефон должен быть в формате +375XXXXXXXXX'),
  body('email').isEmail().withMessage('Неверный формат email'),
  body('password').matches(pwdRegex).withMessage('Пароль должен содержать минимум 8 символов, включая буквы и цифры'),
  body('password_conf').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Пароли не совпадают');
    }
    return true;
  }),
  body('birth').isISO8601().withMessage('Неверный формат даты рождения').custom((value) => {
    const birthDate = new Date(value);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    if (age < 16 || age > 100) {
      throw new Error('Возраст должен быть от 16 до 100 лет');
    }
    return true;
  })
];

const loginValidation = [
    body('email').isEmail().withMessage('Неверный формат email'),
    body('password').notEmpty().withMessage('Пароль не должен быть пустым')
];

// --- ROUTES ---

router.post('/register', registerValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ 
            message: 'Ошибка валидации данных',
            errors: errors.array() 
        });
    }

    const { first_name, last_name, phone, email, password, birth } = req.body;

    console.log('Registration data:', { first_name, last_name, phone, email, birth });

    try {
        const client = await pool.getConnection();
        const existingUser = await client.query('SELECT 1 FROM users WHERE email = ? OR phone = ?', [email, phone]);
        if (existingUser[0].length > 0) {
            client.release();
            return res.status(409).json({ message: 'Пользователь с таким email или телефоном уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        
        const newUserQuery = `
            INSERT INTO users(first_name, last_name, birth_date, phone, email, password_hash)
            VALUES(?, ?, ?, ?, ?, ?);
        `;
        await client.query(newUserQuery, [first_name, last_name, birth, phone, email, hashedPassword]);
        
        const userIdResult = await client.query('SELECT LAST_INSERT_ID() as id');
        const userId = userIdResult[0][0].id;
        client.release();

        const token = jwt.sign({ id: userId, email: email, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        return res.status(201).json({ message: 'Регистрация прошла успешно' });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

// Quick registration endpoint
router.post('/quick-register', [
    body('first_name').isLength({ min: 2, max: 30 }).withMessage('Имя должно быть от 2 до 30 символов'),
    body('password').isLength({ min: 8 }).withMessage('Пароль должен содержать минимум 8 символов'),
    body('password_conf').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Пароли не совпадают');
        }
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            message: 'Ошибка валидации данных',
            errors: errors.array()
        });
    }

    const { first_name, password } = req.body;

    try {
        const client = await pool.getConnection();
        
        // Generate temporary email
        const timestamp = Date.now();
        const tempEmail = `user_${timestamp}@temp.pyon.local`;
        
        // Check if temp email already exists (very unlikely)
        const existingUser = await client.query('SELECT 1 FROM users WHERE email = ?', [tempEmail]);
        if (existingUser[0].length > 0) {
            client.release();
            return res.status(409).json({ message: 'Попробуйте еще раз' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        
        const newUserQuery = `
            INSERT INTO users(first_name, last_name, email, password_hash, is_quick_registration, birth_date, account_number)
            VALUES(?, '', ?, ?, true, '1990-01-01', generate_account_number());
        `;
        await client.query(newUserQuery, [first_name, tempEmail, hashedPassword]);
        
        const userIdResult = await client.query('SELECT LAST_INSERT_ID() as id');
        const userId = userIdResult[0][0].id;
        
        // Get the generated account number
        const accountResult = await client.query('SELECT account_number FROM users WHERE id = ?', [userId]);
        const accountNumber = accountResult[0][0]?.account_number || null;
        client.release();

        const token = jwt.sign({ id: userId, email: tempEmail, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        return res.status(201).json({ 
            message: 'Быстрая регистрация прошла успешно',
            user_id: userId,
            account_number: accountNumber
        });

    } catch (error) {
        console.error('Quick registration error:', error);
        console.error('Error details:', error.message, error.stack);
        return res.status(500).json({ message: 'Внутренняя ошибка сервера', error: error.message });
    }
});


router.post('/login', loginValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const client = await pool.getConnection();
        
        // Try admin table first
        const adminResult = await client.query('SELECT id, email, password_hash FROM admins WHERE email = ?', [email]);
        
        if (adminResult[0].length > 0) {
            const admin = adminResult[0][0];
            const isMatch = await bcrypt.compare(password, admin.password_hash);
            
            if (!isMatch) {
                client.release();
                return res.status(401).json({ message: 'Неверные учетные данные' });
            }
            
            const adminToken = jwt.sign({id: admin.id, email: admin.email, role: 'admin'}, process.env.JWT_SECRET, {expiresIn: '7d'});
            res.cookie('admin_token', adminToken, {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
            client.release();
            return res.json({ role: 'admin', message: 'Вход выполнен успешно' });
        }

        // Try user table
        const userResult = await client.query('SELECT id, email, password_hash FROM users WHERE email = ?', [email]);
        
        if (userResult[0].length === 0) {
            // Try trainer table next
            const trainerResult = await client.query('SELECT id, email, password_hash FROM trainers WHERE email = ?', [email]);
            if (trainerResult[0].length === 0) {
                client.release();
                return res.status(404).json({ message: 'Пользователь не найден' });
            }
            const trainer = trainerResult[0][0];
            const isTrainerMatch = await bcrypt.compare(password, trainer.password_hash || '');
            if (!isTrainerMatch) {
                client.release();
                return res.status(401).json({ message: 'Неверные учетные данные' });
            }
            const tkn = jwt.sign({ id: trainer.id, email: trainer.email, role: 'trainer' }, process.env.JWT_SECRET, { expiresIn: '7d' });
            res.cookie('token', tkn, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
            client.release();
            return res.json({ role: 'trainer', message: 'Вход выполнен успешно' });
        }

        const user = userResult[0][0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            client.release();
            return res.status(401).json({ message: 'Неверные учетные данные' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        client.release();
        res.status(200).json({ message: 'Вход выполнен успешно', role: 'user' });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    try {
        // Clear all authentication cookies
        res.clearCookie('token');
        res.clearCookie('admin_token');
        res.clearCookie('trainer_token');
        
        res.status(200).json({ message: 'Выход выполнен успешно' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

export default router;
