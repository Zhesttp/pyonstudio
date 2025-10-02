# Создание/обновление учётной записи администратора

Пример будет работать после применения `db/schema.sql`, где включено расширение `pgcrypto`.

## Вариант 1. Через psql (однострочная команда)
```bash
psql postgres://pyon:pyon123@localhost:5432/pyon_db \
  -c "INSERT INTO admins (id,name,email,password_hash) 
      VALUES (gen_random_uuid(),'SuperAdmin','admin@pyon.local', crypt('admin123', gen_salt('bf')))
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;"
```

* измените `name`, `email`, `admin123` при необходимости; при повторном запуске пароль перезапишется.

## Вариант 2. Интеррактивно в psql
```sql
-- внутри psql
\c pyon_db
INSERT INTO admins (id,name,email,password_hash)
VALUES (gen_random_uuid(), 'AdminName', 'mail@example.com', crypt('НовыйПароль', gen_salt('bf')))
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
```

## Проверить
```bash
psql postgres://pyon:pyon123@localhost:5432/pyon_db -c "SELECT id,name,email,created_at FROM admins;"
```
Админ готов. На стороне приложения авторизуйтесь с этой почтой и паролем.
