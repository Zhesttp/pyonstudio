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
  if [[ -f $PID_FILE && -e /proc/$(cat $PID_FILE) ]]; then
    echo "Сервер уже запущен (PID $(cat $PID_FILE))"; return; fi
  cd "$PROJECT_DIR"
  npm run start 2>&1 | tee -a "$LOG_FILE" &
  echo $! > "$PID_FILE"
  echo "Сервер запущен, PID $!"
}

stop_server() {
  if [[ -f $PID_FILE ]]; then
    kill $(cat "$PID_FILE") && rm "$PID_FILE" && echo "Сервер остановлен" || echo "Не удалось остановить";
  else
    echo "PID файл не найден — сервер не запущен?";
  fi
}

stop_all_servers() {
  echo "Останавливаю все серверы Node.js..."
  # Останавливаем все процессы node app.js
  pkill -f "node app.js" 2>/dev/null && echo "Все серверы Node.js остановлены" || echo "Серверы Node.js не найдены"
  
  # Удаляем PID файл если он есть
  [[ -f $PID_FILE ]] && rm "$PID_FILE" && echo "PID файл удален"
  
  # Ждем немного чтобы процессы точно завершились
  sleep 2
}

restart_server() { 
  stop_all_servers
  start_server
}

show_logs() {
  tail -n 100 "$LOG_FILE"
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
  echo "1) Запустить сервер"
  echo "2) Остановить сервер"
  echo "3) Перезапустить сервер (остановить все + запустить)"
  echo "4) Остановить ВСЕ серверы Node.js"
  echo "5) Показать последние логи"
  echo "6) Добавить/обновить админа"
  echo "7) Удалить админа"
  echo "8) Список админов"
  echo "9) Показать все таблицы БД"
  echo "10) Показать содержимое таблицы"
  echo "11) 🔥 ПЕРЕСОЗДАТЬ БАЗУ ДАННЫХ (ОСТОРОЖНО!)"
  echo "0) Выход"
  read -p "Выбор: " choice
  case $choice in
    1) start_server;;
    2) stop_server;;
    3) restart_server;;
    4) stop_all_servers;;
    5) show_logs;;
    6) add_admin;;
    7) delete_admin;;
    8) list_admins;;
    9) show_tables;;
    10) show_table;;
    11) recreate_database;;
    0) exit 0;;
    *) echo "Неверный выбор";;
  esac
done
