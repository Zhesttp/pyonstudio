# Pyon Studio База данных

Схема PostgreSQL 15 (`db/schema.sql`).

## Быстрый старт
```bash
psql -U postgres -c "CREATE USER pyon WITH PASSWORD 'pyon123';"
psql -U postgres -f db/schema.sql
```
Будет создана база `pyon_db`. Строка подключения:
```
postgres://pyon:pyon123@localhost:5432/pyon_db
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
CREATE TABLE classes_2025 PARTITION OF classes FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
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
psql "postgres://pyon:pyon123@localhost:5432/pyon_db"

-- посмотреть список таблиц
\dt

-- посмотреть структуру таблицы
\d bookings

-- выборка первых 20 строк
SELECT * FROM bookings LIMIT 20;
```

Используйте `\h` внутри psql для справки по SQL-командам.

```bash
# Если база запущена в контейнере Docker
# Предположим контейнер называется pyon-db

docker exec -it pyon-db psql -U pyon -d pyon_db -c "\dt"   # список таблиц
docker exec -it pyon-db psql -U pyon -d pyon_db -c "SELECT * FROM users LIMIT 10;"
```

## Запуск проекта «с нуля»
```bash
# 1. установить зависимости backend
cd server
npm install          # модули Express, pg, bcrypt …

# 2. создать роль и базу (один раз)
psql -U $(whoami) -d postgres -c "CREATE ROLE pyon WITH LOGIN PASSWORD 'pyon123';"
psql -U $(whoami) -d postgres -c "CREATE DATABASE pyon_db OWNER pyon;"

# 3. накатить структуру
cd ..   # корень проекта
tail -n +5 db/schema.sql | psql -U pyon -d pyon_db   # без CREATE DATABASE

# 4. скопировать переменные окружения и запустить сервер
cd server
cp .env.example .env     # при первом запуске, либо создайте руками
npm run dev              # nodemon app.js (порт 3000)
```

## Полное пересоздание БД
```bash
# остановить backend, если запущен (Ctrl+C)

psql -U $(whoami) -d postgres -c "DROP DATABASE IF EXISTS pyon_db;"
psql -U $(whoami) -d postgres -c "CREATE DATABASE pyon_db OWNER pyon;"

tail -n +5 db/schema.sql | psql -U pyon -d pyon_db

# заново запустить сервер
cd server
npm run dev
```

> `$(whoami)` под macOS/Homebrew равен вашему системному пользователю, у которого есть права superuser в PostgreSQL.








<!-- удалить  бд-->
$ psql -U zhest -d postgres -c "DROP DATABASE IF EXISTS pyon_db;"


% создать  бд 
$ psql -U zhest -d postgres -c "CREATE DATABASE pyon_db OWNER pyon;"


<!-- активировать схему  -->
$ psql -U pyon -d pyon_db -f /Users/zhest/Documents/work/konstantin/db/schema.sql
