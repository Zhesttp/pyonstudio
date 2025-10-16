export default {
  apps: [{
    name: 'pyon-studio',
    script: 'app.js',
    instances: 'max', // Кластеризация - используем все CPU ядра
    exec_mode: 'cluster',
    
    // Автоматический перезапуск
    autorestart: true,
    watch: false, // Отключаем в продакшене для производительности
    max_memory_restart: '1G', // Перезапуск при превышении 1GB памяти
    
    // Переменные окружения
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Логирование
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Настройки перезапуска
    min_uptime: '10s', // Минимальное время работы перед перезапуском
    max_restarts: 10, // Максимальное количество перезапусков за 1 минуту
    
    // Настройки кластера
    kill_timeout: 5000, // Время ожидания перед принудительным завершением
    listen_timeout: 3000, // Время ожидания готовности приложения
    
    // Мониторинг
    pmx: true, // Включаем мониторинг PM2
    
    // Дополнительные настройки
    node_args: '--max-old-space-size=1024', // Ограничение памяти для Node.js
    merge_logs: true, // Объединяем логи всех инстансов
    time: true // Добавляем время в логи
  }]
};
