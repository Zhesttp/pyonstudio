#!/usr/bin/env bash
# Интерактивное меню управления сервером и БД PYon

DB_URL=${DATABASE_URL:-"mysql://pyon:pyon123@localhost:3306/pyon_db"}
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$BASE_DIR/server.log"
PID_FILE="$BASE_DIR/server.pid"
PROJECT_DIR="$BASE_DIR"

add_admin() {
  read -p "Имя: " NAME
  read -p "Email: " EMAIL
  read -s -p "Пароль: " PASS; echo
  
  # Хешируем пароль с помощью Node.js
  HASHED_PASS=$(node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('$PASS', 12));")
  
  MYSQL_CMD="INSERT INTO admins (id,name,email,password_hash) VALUES (UUID(),'$NAME','$EMAIL', '$HASHED_PASS') ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name);"
  mysql -u pyon -ppyon123 pyon_db -e "$MYSQL_CMD" && echo "Админ добавлен/обновлён"
}

delete_admin() {
  read -p "Email админа для удаления: " EMAIL
  mysql -u pyon -ppyon123 pyon_db -e "DELETE FROM admins WHERE email='$EMAIL';" && echo "Удалено"
}

list_admins() {
  mysql -u pyon -ppyon123 pyon_db -e "SELECT id,name,email,created_at FROM admins ORDER BY created_at;"
}

show_tables() {
  mysql -u pyon -ppyon123 pyon_db -e "SHOW TABLES;"
}

show_table() {
  read -p "Имя таблицы: " TBL
  mysql -u pyon -ppyon123 pyon_db -e "SELECT * FROM \`$TBL\` LIMIT 50;"
}

start_server() {
  echo "Выберите режим запуска:"
  echo "1) Обычный режим (node app.js)"
  echo "2) PM2 режим (кластеризация + автоперезапуск)"
  read -p "Выбор (1-2): " mode
  
  if [[ "$mode" == "2" ]]; then
    start_server_pm2
  else
    start_server_normal
  fi
}

start_server_normal() {
  if [[ -f $PID_FILE && -e /proc/$(cat $PID_FILE) ]]; then
    echo "Сервер уже запущен (PID $(cat $PID_FILE))"; return; fi
  cd "$PROJECT_DIR"
  
  echo "🚀 Запуск сервера в обычном режиме..."
  echo "📱 Проверка Telegram бота..."
  
  # Проверяем наличие переменных Telegram бота
  if [[ -f .env ]]; then
    if grep -q "TELEGRAM_BOT_TOKEN" .env && grep -q "TELEGRAM_CHAT_ID" .env; then
      echo "✅ Telegram бот настроен в .env файле"
    else
      echo "⚠️  Telegram бот не настроен: отсутствуют TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID"
    fi
  else
    echo "⚠️  Файл .env не найден. Telegram бот будет отключен"
  fi
  
  npm run start 2>&1 | tee -a "$LOG_FILE" &
  echo $! > "$PID_FILE"
  echo "✅ Сервер запущен в обычном режиме, PID $!"
  echo "📱 Telegram бот будет инициализирован автоматически при запуске"
}

start_server_pm2() {
  echo "🚀 Запуск сервера через PM2..."
  cd "$PROJECT_DIR"
  
  echo "📱 Проверка Telegram бота..."
  
  # Проверяем наличие переменных Telegram бота
  if [[ -f .env ]]; then
    if grep -q "TELEGRAM_BOT_TOKEN" .env && grep -q "TELEGRAM_CHAT_ID" .env; then
      echo "✅ Telegram бот настроен в .env файле"
    else
      echo "⚠️  Telegram бот не настроен: отсутствуют TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID"
    fi
  else
    echo "⚠️  Файл .env не найден. Telegram бот будет отключен"
  fi
  
  # Проверяем, установлен ли PM2
  if ! npx pm2 --version >/dev/null 2>&1; then
    echo "❌ PM2 не найден. Устанавливаю..."
    npm install pm2 --save-dev
  fi
  
  # Запускаем PM2 с кластеризацией
  npx pm2 start ./app.js --name pyon-studio --instances max
  echo "✅ Сервер запущен через PM2 с кластеризацией!"
  echo "📱 Telegram бот будет инициализирован автоматически при запуске"
  npx pm2 status
}

stop_server() {
  echo "Выберите режим остановки:"
  echo "1) Остановить обычный сервер"
  echo "2) Остановить PM2 сервер"
  echo "3) Остановить все (обычный + PM2)"
  read -p "Выбор (1-3): " mode
  
  case "$mode" in
    1) stop_server_normal;;
    2) stop_server_pm2;;
    3) stop_all_servers;;
    *) echo "Неверный выбор";;
  esac
}

stop_server_normal() {
  if [[ -f $PID_FILE ]]; then
    kill $(cat "$PID_FILE") && rm "$PID_FILE" && echo "Обычный сервер остановлен" || echo "Не удалось остановить";
  else
    echo "PID файл не найден — обычный сервер не запущен?";
  fi
}

stop_server_pm2() {
  echo "⏹️  Остановка PM2 сервера..."
  cd "$PROJECT_DIR"
  npx pm2 stop pyon-studio 2>/dev/null && echo "✅ PM2 сервер остановлен" || echo "PM2 сервер не найден"
  npx pm2 status
}

stop_all_servers() {
  echo "🛑 Останавливаю все серверы Node.js..."
  
  # Останавливаем PM2 если запущен
  cd "$PROJECT_DIR"
  npx pm2 stop pyon-studio 2>/dev/null && echo "✅ PM2 сервер остановлен" || echo "PM2 сервер не найден"
  npx pm2 delete pyon-studio 2>/dev/null && echo "✅ PM2 приложение удалено" || echo "PM2 приложение не найдено"
  
  # Останавливаем все процессы node app.js
  pkill -f "node app.js" 2>/dev/null && echo "✅ Все серверы Node.js остановлены" || echo "Серверы Node.js не найдены"
  
  # Удаляем PID файл если он есть
  [[ -f $PID_FILE ]] && rm "$PID_FILE" && echo "✅ PID файл удален"
  
  # Ждем немного чтобы процессы точно завершились
  sleep 2
  echo "🎯 Все серверы остановлены!"
}

restart_server() { 
  stop_all_servers
  start_server
}

show_logs() {
  echo "Выберите источник логов:"
  echo "1) Обычные логи сервера"
  echo "2) PM2 логи"
  echo "3) PM2 мониторинг"
  echo "4) Поиск логов Telegram бота"
  read -p "Выбор (1-4): " choice
  
  case "$choice" in
    1) 
      echo "📋 Последние 100 строк логов сервера:"
      tail -n 100 "$LOG_FILE"
      ;;
    2) 
      echo "📋 PM2 логи (нажмите Ctrl+C для выхода):"
      cd "$PROJECT_DIR" && npx pm2 logs pyon-studio
      ;;
    3) 
      echo "📊 PM2 мониторинг (нажмите Ctrl+C для выхода):"
      cd "$PROJECT_DIR" && npx pm2 monit
      ;;
    4)
      echo "📱 Поиск логов Telegram бота:"
      echo "=== Обычные логи ==="
      grep -i "telegram\|bot" "$LOG_FILE" | tail -20
      echo ""
      echo "=== PM2 логи ==="
      cd "$PROJECT_DIR" && npx pm2 logs pyon-studio --lines 50 | grep -i "telegram\|bot" || echo "Нет логов Telegram бота в PM2"
      ;;
    *) echo "Неверный выбор";;
  esac
}

pm2_status() {
  echo "📊 Статус PM2:"
  cd "$PROJECT_DIR"
  npx pm2 status
}

pm2_restart() {
  echo "🔄 Перезапуск PM2 сервера..."
  cd "$PROJECT_DIR"
  npx pm2 restart pyon-studio
  echo "✅ PM2 сервер перезапущен!"
  echo "📱 Telegram бот будет переинициализирован автоматически"
  npx pm2 status
}

check_telegram_bot() {
  echo "📱 Проверка настроек Telegram бота..."
  cd "$PROJECT_DIR"
  
  if [[ -f .env ]]; then
    echo "✅ Файл .env найден"
    
    if grep -q "TELEGRAM_BOT_TOKEN" .env; then
      TOKEN_LINE=$(grep "TELEGRAM_BOT_TOKEN" .env)
      # Проверяем, что токен не пустой и не содержит placeholder
      if [[ "$TOKEN_LINE" == *"your_telegram_bot_token_here"* ]] || [[ "$TOKEN_LINE" == *"TELEGRAM_BOT_TOKEN=$"* ]] || [[ "$TOKEN_LINE" == *"TELEGRAM_BOT_TOKEN=\"\""* ]] || [[ -z "${TOKEN_LINE#*=}" ]]; then
        echo "⚠️  TELEGRAM_BOT_TOKEN не настроен (используется значение по умолчанию)"
      else
        echo "✅ TELEGRAM_BOT_TOKEN настроен"
      fi
    else
      echo "❌ TELEGRAM_BOT_TOKEN не найден в .env"
    fi
    
    # TELEGRAM_CHAT_ID больше не используется в новой системе
    if grep -q "TELEGRAM_CHAT_ID" .env; then
      echo "ℹ️  TELEGRAM_CHAT_ID найден в .env, но больше не используется"
      echo "   Используйте систему Telegram админов через пункт 9 меню"
    else
      echo "ℹ️  TELEGRAM_CHAT_ID не найден - это нормально для новой системы"
    fi
    
    # Проверяем количество Telegram админов
    ADMIN_COUNT=$(mysql -u pyon -ppyon123 pyon_db -e "SELECT COUNT(*) FROM telegram_admins WHERE is_active = 1;" 2>/dev/null | tail -n +2)
    if [[ "$ADMIN_COUNT" -gt 0 ]]; then
      echo "✅ Найдено $ADMIN_COUNT активных Telegram админов"
    else
      echo "⚠️  Нет активных Telegram админов"
      echo "   Добавьте админов через пункт 9 меню"
    fi
    
    echo ""
    echo "📋 Инструкция по настройке:"
    echo "1. Создайте бота через @BotFather в Telegram"
    echo "2. Получите токен бота"
    echo "3. Отправьте боту сообщение и получите Chat ID через API"
    echo "4. Обновите .env файл с реальными значениями"
    echo "5. Добавьте Telegram админов через пункт 9 меню"
  else
    echo "❌ Файл .env не найден"
    echo "📋 Создайте файл .env на основе env.example"
  fi
}

add_telegram_admin() {
  echo "📱 Добавление Telegram админа..."
  read -p "Имя админа: " NAME
  read -p "Chat ID: " CHAT_ID
  
  if [[ -z "$NAME" || -z "$CHAT_ID" ]]; then
    echo "❌ Имя и Chat ID не могут быть пустыми"
    return 1
  fi
  
  # Проверяем, что Chat ID содержит только цифры (может быть отрицательным)
  if [[ ! "$CHAT_ID" =~ ^-?[0-9]+$ ]]; then
    echo "❌ Chat ID должен содержать только цифры (может быть отрицательным)"
    return 1
  fi
  
  MYSQL_CMD="INSERT INTO telegram_admins (id, name, chat_id) VALUES (UUID(), '$NAME', '$CHAT_ID') ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1;"
  mysql -u pyon -ppyon123 pyon_db -e "$MYSQL_CMD" && echo "✅ Telegram админ '$NAME' добавлен/обновлён" || echo "❌ Ошибка добавления админа"
}

delete_telegram_admin() {
  echo "📱 Удаление Telegram админа..."
  read -p "Chat ID админа для удаления: " CHAT_ID
  
  if [[ -z "$CHAT_ID" ]]; then
    echo "❌ Chat ID не может быть пустым"
    return 1
  fi
  
  # Показываем информацию об админе перед удалением
  ADMIN_INFO=$(mysql -u pyon -ppyon123 pyon_db -e "SELECT name FROM telegram_admins WHERE chat_id='$CHAT_ID';" 2>/dev/null | tail -n +2)
  
  if [[ -z "$ADMIN_INFO" ]]; then
    echo "❌ Telegram админ с Chat ID '$CHAT_ID' не найден"
    return 1
  fi
  
  echo "Найден админ: $ADMIN_INFO"
  read -p "Вы уверены, что хотите удалить этого админа? (y/N): " confirm
  
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    mysql -u pyon -ppyon123 pyon_db -e "DELETE FROM telegram_admins WHERE chat_id='$CHAT_ID';" && echo "✅ Telegram админ удалён" || echo "❌ Ошибка удаления админа"
  else
    echo "❌ Удаление отменено"
  fi
}

list_telegram_admins() {
  echo "📱 Список Telegram админов:"
  echo "┌─────────────────────────────────────────────────────────────┐"
  echo "│ ID                                    │ Имя        │ Chat ID  │ Статус │"
  echo "├─────────────────────────────────────────────────────────────┤"
  mysql -u pyon -ppyon123 pyon_db -e "SELECT 
    SUBSTRING(id, 1, 8) as short_id,
    name,
    chat_id,
    CASE WHEN is_active = 1 THEN 'Активен' ELSE 'Неактивен' END as status
  FROM telegram_admins 
  ORDER BY created_at;" 2>/dev/null | tail -n +2 | while read -r line; do
    if [[ -n "$line" ]]; then
      printf "│ %-36s │ %-10s │ %-8s │ %-6s │\n" $line
    fi
  done
  echo "└─────────────────────────────────────────────────────────────┘"
}

toggle_telegram_admin() {
  echo "📱 Изменение статуса Telegram админа..."
  read -p "Chat ID админа: " CHAT_ID
  
  if [[ -z "$CHAT_ID" ]]; then
    echo "❌ Chat ID не может быть пустым"
    return 1
  fi
  
  # Получаем текущий статус
  CURRENT_STATUS=$(mysql -u pyon -ppyon123 pyon_db -e "SELECT is_active, name FROM telegram_admins WHERE chat_id='$CHAT_ID';" 2>/dev/null | tail -n +2)
  
  if [[ -z "$CURRENT_STATUS" ]]; then
    echo "❌ Telegram админ с Chat ID '$CHAT_ID' не найден"
    return 1
  fi
  
  read -r IS_ACTIVE NAME <<< "$CURRENT_STATUS"
  NEW_STATUS=$((1 - IS_ACTIVE))
  STATUS_TEXT=$([ "$NEW_STATUS" -eq 1 ] && echo "активен" || echo "неактивен")
  
  echo "Админ: $NAME"
  echo "Текущий статус: $([ "$IS_ACTIVE" -eq 1 ] && echo "активен" || echo "неактивен")"
  echo "Новый статус: $STATUS_TEXT"
  
  read -p "Продолжить? (y/N): " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    mysql -u pyon -ppyon123 pyon_db -e "UPDATE telegram_admins SET is_active=$NEW_STATUS WHERE chat_id='$CHAT_ID';" && echo "✅ Статус админа изменён на '$STATUS_TEXT'" || echo "❌ Ошибка изменения статуса"
  else
    echo "❌ Изменение отменено"
  fi
}

recreate_database() {
  echo "⚠️  ВНИМАНИЕ: Это действие удалит ВСЕ данные в базе!"
  read -p "Вы уверены? Введите 'YES' для подтверждения: " confirm
  if [[ "$confirm" != "YES" ]]; then
    echo "Операция отменена"
    return
  fi
  
  echo "Останавливаю все серверы..."
  stop_all_servers
  
  echo "Пересоздаю базу данных..."
  
  # Извлекаем параметры из DB_URL
  DB_NAME=$(echo "$DB_URL" | sed 's/.*\///')
  DB_HOST=$(echo "$DB_URL" | sed 's/.*@\([^:]*\):.*/\1/')
  DB_PORT=$(echo "$DB_URL" | sed 's/.*:\([0-9]*\)\/.*/\1/')
  DB_USER=$(echo "$DB_URL" | sed 's/.*:\/\/\([^:]*\):.*/\1/')
  DB_PASS=$(echo "$DB_URL" | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')
  
  # Удаляем базу если существует
  echo "Удаляю базу данных '$DB_NAME'..."
  mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" -e "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || echo "База не существовала или ошибка при удалении"
  
  # Создаем новую базу
  echo "Создаю новую базу данных '$DB_NAME'..."
  mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" -e "CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || {
    echo "❌ Ошибка создания базы данных (недостаточно прав?)."
    echo "Подсказка: убедитесь что пользователь '$DB_USER' имеет права на создание баз данных"
    return 1
  }
  
  # Применяем схему
  echo "Применяю схему базы данных..."
  mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" < "$BASE_DIR/../db/schema.sql" || {
    echo "❌ Ошибка применения схемы"
    return 1
  }
  
  echo "✅ База данных успешно пересоздана!"
  echo "Теперь можно запустить сервер (пункт 1)"
}

while true; do
  echo "\n===== PYon Management Menu ====="
  echo "🚀 СЕРВЕР:"
  echo "1) Запустить сервер (обычный/PM2)"
  echo "2) Остановить сервер (обычный/PM2)"
  echo "3) Перезапустить сервер (остановить все + запустить)"
  echo "4) Остановить ВСЕ серверы Node.js"
  echo "5) Показать логи (обычные/PM2/мониторинг)"
  echo ""
  echo "📊 PM2 УПРАВЛЕНИЕ:"
  echo "6) Статус PM2"
  echo "7) Перезапуск PM2"
  echo ""
  echo "📱 TELEGRAM БОТ:"
  echo "8) Проверить настройки Telegram бота"
  echo "9) Добавить Telegram админа"
  echo "10) Удалить Telegram админа"
  echo "11) Список Telegram админов"
  echo "12) Изменить статус Telegram админа"
  echo ""
  echo "👨‍💼 АДМИНЫ:"
  echo "13) Добавить/обновить админа"
  echo "14) Удалить админа"
  echo "15) Список админов"
  echo ""
  echo "🗄️  БАЗА ДАННЫХ:"
  echo "16) Показать все таблицы БД"
  echo "17) Показать содержимое таблицы"
  echo "18) 🔥 ПЕРЕСОЗДАТЬ БАЗУ ДАННЫХ (ОСТОРОЖНО!)"
  echo ""
  echo "0) Выход"
  read -p "Выбор: " choice
  case $choice in
    1) start_server;;
    2) stop_server;;
    3) restart_server;;
    4) stop_all_servers;;
    5) show_logs;;
    6) pm2_status;;
    7) pm2_restart;;
    8) check_telegram_bot;;
    9) add_telegram_admin;;
    10) delete_telegram_admin;;
    11) list_telegram_admins;;
    12) toggle_telegram_admin;;
    13) add_admin;;
    14) delete_admin;;
    15) list_admins;;
    16) show_tables;;
    17) show_table;;
    18) recreate_database;;
    0) exit 0;;
    *) echo "Неверный выбор";;
  esac
done
