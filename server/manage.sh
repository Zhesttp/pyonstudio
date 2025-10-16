#!/usr/bin/env bash
# Интерактивное меню управления сервером и БД PYon

DB_URL=${DATABASE_URL:-"postgres://pyon:pyon123@localhost:5432/pyon_db"}
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$BASE_DIR/server.log"
PID_FILE="$BASE_DIR/server.pid"
PROJECT_DIR="$BASE_DIR"

add_admin() {
  read -p "Имя: " NAME
  read -p "Email: " EMAIL
  read -s -p "Пароль: " PASS; echo
  PSQL_CMD="INSERT INTO admins (id,name,email,password_hash) VALUES (gen_random_uuid(),'$NAME','$EMAIL', crypt('$PASS', gen_salt('bf'))) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,name = EXCLUDED.name;"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "$PSQL_CMD" && echo "Админ добавлен/обновлён"
}

delete_admin() {
  read -p "Email админа для удаления: " EMAIL
  psql "$DB_URL" -c "DELETE FROM admins WHERE email='$EMAIL';" && echo "Удалено"
}

list_admins() {
  psql "$DB_URL" -c "SELECT id,name,email,created_at FROM admins ORDER BY created_at;"
}

show_tables() {
  psql "$DB_URL" -c "\dt"
}

show_table() {
  read -p "Имя таблицы: " TBL
  psql "$DB_URL" -c "TABLE \"$TBL\" LIMIT 50;"
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
  npm run start 2>&1 | tee -a "$LOG_FILE" &
  echo $! > "$PID_FILE"
  echo "Сервер запущен в обычном режиме, PID $!"
}

start_server_pm2() {
  echo "🚀 Запуск сервера через PM2..."
  cd "$PROJECT_DIR"
  
  # Проверяем, установлен ли PM2
  if ! npx pm2 --version >/dev/null 2>&1; then
    echo "❌ PM2 не найден. Устанавливаю..."
    npm install pm2 --save-dev
  fi
  
  # Запускаем PM2 с кластеризацией
  npx pm2 start ./app.js --name pyon-studio --instances max
  echo "✅ Сервер запущен через PM2 с кластеризацией!"
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
  read -p "Выбор (1-3): " choice
  
  case "$choice" in
    1) tail -n 100 "$LOG_FILE";;
    2) cd "$PROJECT_DIR" && npx pm2 logs pyon-studio;;
    3) cd "$PROJECT_DIR" && npx pm2 monit;;
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
  npx pm2 status
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
  
  # Подключаемся к postgres для удаления/создания БД
  # Можно переопределить суперпользователя через переменную окружения DB_SUPERUSER_URL
  POSTGRES_URL="postgres://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/postgres"
  MAINT_URL=${DB_SUPERUSER_URL:-$POSTGRES_URL}
  
  # Удаляем базу если существует
  echo "Удаляю базу данных '$DB_NAME'..."
  psql "$MAINT_URL" -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || echo "База не существовала или ошибка при удалении"
  
  # Создаем новую базу
  echo "Создаю новую базу данных '$DB_NAME'..."
  psql "$MAINT_URL" -c "CREATE DATABASE $DB_NAME;" || {
    echo "❌ Ошибка создания базы данных (недостаточно прав?)."
    echo "Подсказка: установите переменную DB_SUPERUSER_URL с доступом суперпользователя, или дайте роли '$DB_USER' право CREATEDB:"
    echo "  psql $MAINT_URL -c \"ALTER ROLE $DB_USER CREATEDB;\""
    return 1
  }
  
  # Применяем схему
  echo "Применяю схему базы данных..."
  psql "$DB_URL" -f "$BASE_DIR/../db/schema.sql" || {
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
  echo "👨‍💼 АДМИНЫ:"
  echo "8) Добавить/обновить админа"
  echo "9) Удалить админа"
  echo "10) Список админов"
  echo ""
  echo "🗄️  БАЗА ДАННЫХ:"
  echo "11) Показать все таблицы БД"
  echo "12) Показать содержимое таблицы"
  echo "13) 🔥 ПЕРЕСОЗДАТЬ БАЗУ ДАННЫХ (ОСТОРОЖНО!)"
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
    8) add_admin;;
    9) delete_admin;;
    10) list_admins;;
    11) show_tables;;
    12) show_table;;
    13) recreate_database;;
    0) exit 0;;
    *) echo "Неверный выбор";;
  esac
done
