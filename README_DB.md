# Pyon Studio База данных

Схема MySQL 8.0 (`db/schema.sql`).

## Быстрый старт
```bash
mysql -u root -p -e "CREATE USER 'pyon'@'localhost' IDENTIFIED BY 'pyon123';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON pyon_db.* TO 'pyon'@'localhost';"
mysql -u pyon -ppyon123 < db/schema.sql
```
Будет создана база `pyon_db`. Строка подключения:
```
mysql://pyon:pyon123@localhost:3306/pyon_db
```
## Основные сущности
| Таблица | Назначение |
|---------|------------|
| admins | администраторы студии |
| users | клиенты |
| trainers | тренеры |
| plans | абонементы |
| user_subscriptions | покупки абонементов |
| classes | расписание занятий |
| bookings | запись клиента на занятие |

Дополнительные таблицы: roles/permissions, payments, attendance, uploads, audit_log, settings, translations, webhooks, waitlists.

## Сценарии работы
### Регистрация и запись
1. Создаётся запись в `users` (пароль — bcrypt).  
2. Админ назначает `plan` через `user_subscriptions`.  
3. Клиент записывается на занятие → вставка в `bookings` (`status = booked`).  
4. Если мест нет — запись в `waitlist_entries`.  
5. Тренер отмечает посещаемость → `attendance`.

### Аудит действий администратора
Триггеры должны писать в `audit_log` с фиксацией `OLD` и `NEW`.

### Платежи
После веб-хука провайдера обновляется `payments.status = paid`, при необходимости продлевается `user_subscriptions`.

## Партиционирование (опционально)
```sql
-- MySQL поддерживает партиционирование по диапазону
ALTER TABLE classes PARTITION BY RANGE (YEAR(class_date)) (
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027)
);
```
Автоматизация — ежегодно.

## Точки API
* `/auth/*` – выдача JWT (admins / users).
* `/classes` – список занятий (join `classes` + `trainers`).
* `/bookings` – CRUD с проверкой абонемента и вместимости.
* `/attendance` – отметки тренера.

## Замечания по безопасности
* Хранить только bcrypt-хэши.  
* Использовать roles/permissions для защиты эндпоинтов.  
* При мультитенантности включить `row_level_security`.

---

## Подключение и просмотр данных

```bash
# Подключаемся под пользователем pyon
mysql -u pyon -ppyon123 pyon_db

-- посмотреть список таблиц
SHOW TABLES;

-- посмотреть структуру таблицы
DESCRIBE bookings;

-- выборка первых 20 строк
SELECT * FROM bookings LIMIT 20;
```

Используйте `HELP` внутри mysql для справки по SQL-командам.

```bash
# Если база запущена в контейнере Docker
# Предположим контейнер называется pyon-db

docker exec -it pyon-db mysql -u pyon -ppyon123 pyon_db -e "SHOW TABLES;"   # список таблиц
docker exec -it pyon-db mysql -u pyon -ppyon123 pyon_db -e "SELECT * FROM users LIMIT 10;"
```

## Запуск проекта «с нуля»
```bash
# 1. установить зависимости backend
cd server
npm install          # модули Express, mysql2, bcrypt …

# 2. создать пользователя и базу (один раз)
mysql -u root -p -e "CREATE USER 'pyon'@'localhost' IDENTIFIED BY 'pyon123';"
mysql -u root -p -e "CREATE DATABASE pyon_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON pyon_db.* TO 'pyon'@'localhost';"

# 3. накатить структуру
cd ..   # корень проекта
mysql -u pyon -ppyon123 < db/schema.sql

# 4. скопировать переменные окружения и запустить сервер
cd server
cp .env.example .env     # при первом запуске, либо создайте руками
npm run dev              # nodemon app.js (порт 3000)
```

## Полное пересоздание БД
```bash
# остановить backend, если запущен (Ctrl+C)

mysql -u root -p -e "DROP DATABASE IF EXISTS pyon_db;"
mysql -u root -p -e "CREATE DATABASE pyon_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON pyon_db.* TO 'pyon'@'localhost';"

mysql -u pyon -ppyon123 < db/schema.sql

# заново запустить сервер
cd server
npm run dev
```

## Миграция данных с PostgreSQL на MySQL
```bash
# 1. Убедитесь, что обе базы данных запущены
# 2. Настройте переменные окружения для обеих БД
# 3. Запустите скрипт миграции
node migrate_to_mysql.js
```








<!-- удалить  бд-->
$ mysql -u root -p -e "DROP DATABASE IF EXISTS pyon_db;"

<!-- создать  бд -->
$ mysql -u root -p -e "CREATE DATABASE pyon_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
$ mysql -u root -p -e "GRANT ALL PRIVILEGES ON pyon_db.* TO 'pyon'@'localhost';"

<!-- активировать схему  -->
$ mysql -u pyon -ppyon123 < /Users/zhest/Documents/work/konstantin/db/schema.sql
