import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { body, validationResult } from 'express-validator';
import { pool } from '../db.js';

const router = express.Router();

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Функция для отправки сообщений всем активным Telegram админам
async function sendToAllTelegramAdmins(message) {
  try {
    const client = await pool.getConnection();
    try {
      // Получаем всех активных Telegram админов
      const [admins] = await client.query('SELECT chat_id, name FROM telegram_admins WHERE is_active = 1');
      
      if (admins.length === 0) {
        console.log('⚠️  Нет активных Telegram админов для отправки уведомлений');
        return;
      }
      
      console.log(`📱 Отправка сообщения ${admins.length} Telegram админам...`);
      
      // Отправляем сообщение каждому админу
      for (const admin of admins) {
        try {
          await bot.sendMessage(admin.chat_id, message, {
            parse_mode: 'Markdown'
          });
          console.log(`✅ Сообщение отправлено админу: ${admin.name} (${admin.chat_id})`);
        } catch (error) {
          console.error(`❌ Ошибка отправки админу ${admin.name} (${admin.chat_id}):`, error.message);
        }
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Ошибка получения списка Telegram админов:', error.message);
  }
}

// Validation middleware
const contactValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Имя должно содержать от 2 до 50 символов'),
  body('phone')
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]{7,25}$/)
    .withMessage('Введите корректный номер телефона'),
  body('message')
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Сообщение должно содержать от 5 до 1000 символов')
];

// Contact form endpoint
router.post('/contact', contactValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { name, phone, message } = req.body;

    // Format message for Telegram
    const telegramMessage = `📞 *Новый вопрос от клиента*

👤 *Имя:* ${name}
📱 *Телефон:* ${phone}

💬 *Сообщение:*
${message}

⏰ *Время:* ${new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Minsk',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    // Send message to all active Telegram admins
    if (process.env.TELEGRAM_BOT_TOKEN) {
      await sendToAllTelegramAdmins(telegramMessage);
    }

    res.json({
      success: true,
      message: 'Сообщение успешно отправлено! Мы свяжемся с вами в ближайшее время.'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Произошла ошибка при отправке сообщения. Попробуйте позже.'
    });
  }
});

export default router;
