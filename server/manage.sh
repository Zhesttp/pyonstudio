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

restart_server() { stop_server; start_server; }

show_logs() {
  tail -n 100 "$LOG_FILE"
}

while true; do
  echo "\n===== PYon Management Menu ====="
  echo "1) Запустить сервер"
  echo "2) Остановить сервер"
  echo "3) Перезапустить сервер"
  echo "4) Показать последние логи"
  echo "5) Добавить/обновить админа"
  echo "6) Удалить админа"
  echo "7) Список админов"
  echo "8) Показать все таблицы БД"
  echo "9) Показать содержимое таблицы"
  echo "0) Выход"
  read -p "Выбор: " choice
  case $choice in
    1) start_server;;
    2) stop_server;;
    3) restart_server;;
    4) show_logs;;
    5) add_admin;;
    6) delete_admin;;
    7) list_admins;;
    8) show_tables;;
    9) show_table;;
    0) exit 0;;
    *) echo "Неверный выбор";;
  esac
done
