#!/usr/bin/env bash

# Скрипт запуска приложения. Перед стартом можно создать/обновить учётную запись администратора.
# Безопасно: пароль вводится скрыто, запрос выполняется в БД через pgcrypto (bcrypt).

DB_URL=${DATABASE_URL:-"postgres://pyon:pyon123@localhost:5432/pyon_db"}
APP_CMD="npm run dev"

read -p "Хотите создать/обновить админа? (y/N) " yn
if [[ $yn == "y" || $yn == "Y" ]]; then
  read -p "Имя: " NAME
  read -p "Email: " EMAIL
  read -s -p "Пароль: " PASS
  echo

  psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
  INSERT INTO admins (id, name, email, password_hash)
  VALUES (gen_random_uuid(), :'NAME', :'EMAIL', crypt(:'PASS', gen_salt('bf')))
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name;
SQL
  if [[ $? -eq 0 ]]; then
    echo "Администратор создан/обновлён."
  else
    echo "Не удалось создать админа." >&2
  fi
fi

# Запуск приложения
exec npm run start
