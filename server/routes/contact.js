import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

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

    // Send message to Telegram
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, telegramMessage, {
          parse_mode: 'Markdown'
        });
      } catch (telegramError) {
        console.error('Telegram error:', telegramError);
        // Don't fail the request if Telegram fails
      }
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
