import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = Router();

// Validation rules
const phoneRegex = /^\+375\d{9}$/;
const pwdRegex = /^(?=.*[A-Za-z])(?=(?:.*\d){5,8}).{6,9}$/;

const registerValidation = [
  body('first_name').isAlpha('ru-RU', {ignore: ' '}).withMessage('Имя должно содержать только буквы').isLength({ min: 2, max: 30 }),
  body('last_name').isAlpha('ru-RU', {ignore: ' '}).withMessage('Фамилия должна содержать только буквы').isLength({ min: 2, max: 30 }),
  body('phone').matches(phoneRegex).withMessage('Неверный формат телефона'),
  body('email').isEmail().withMessage('Неверный формат email'),
  body('password').matches(pwdRegex).withMessage('Пароль не соответствует требованиям'),
  body('password_conf').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Пароли не совпадают');
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
        return res.status(400).json({ errors: errors.array() });
    }

    const { first_name, last_name, phone, email, password, birth, level } = req.body;

    try {
        const client = await pool.connect();
        const existingUser = await client.query('SELECT 1 FROM users WHERE email = $1 OR phone = $2', [email, phone]);
        if (existingUser.rowCount > 0) {
            client.release();
            return res.status(409).json({ message: 'Пользователь с таким email или телефоном уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        
        const newUserQuery = `
            INSERT INTO users(first_name, last_name, birth_date, phone, email, password_hash, level)
            VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id;
        `;
        const newUser = await client.query(newUserQuery, [first_name, last_name, birth, phone, email, hashedPassword, level]);
        
        const userId = newUser.rows[0].id;
        client.release();

        const token = jwt.sign({ id: userId, email: email }, process.env.JWT_SECRET, { expiresIn: '7d' });
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


router.post('/login', loginValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const client = await pool.connect();
        const result = await client.query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
        client.release();
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Неверные учетные данные' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({ message: 'Вход выполнен успешно' });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

export default router;
