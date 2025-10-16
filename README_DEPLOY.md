# 🚀 Инструкция по установке PYon Studio на сервер

## 📋 Что нужно подготовить

### 1. Доступ к серверу
- SSH доступ к серверу hoster.by
- Логин и пароль для сервера
- Домен (например, yoursite.com)

### 2. Программы на сервере
Убедитесь, что на сервере установлены:
- **Node.js** (версия 16 или выше)
- **PostgreSQL** (база данных)
- **Nginx** (веб-сервер)

---

## 🔧 Шаг 1: Подготовка файлов

### Создайте файл `.env` в папке `server/`
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://pyon:ваш_пароль@localhost:5432/pyon_db
JWT_SECRET=ваш_секретный_ключ_минимум_32_символа
```

### Создайте файл `package.json` в папке `server/`
```json
{
  "name": "pyon-studio",
  "version": "1.0.0",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "csurf": "^1.11.0",
    "express-validator": "^7.0.1",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "pm2": "^5.3.0"
  }
}
```

---

## 📤 Шаг 2: Загрузка на сервер

### Способ 1: Через FTP клиент (FileZilla)
1. Скачайте FileZilla
2. Подключитесь к серверу:
   - Хост: IP адрес сервера
   - Пользователь: ваш логин
   - Пароль: ваш пароль
   - Порт: 22 (SSH) или 21 (FTP)
3. Загрузите все файлы проекта в папку `/home/ваш_логин/pyon-studio/`

### Способ 2: Через SSH
```bash
# Подключитесь к серверу
ssh ваш_логин@IP_адрес_сервера

# Создайте папку для проекта
mkdir pyon-studio
cd pyon-studio

# Загрузите файлы (используйте scp или rsync)
```

---

## 🗄️ Шаг 3: Настройка базы данных

### Подключитесь к PostgreSQL
```bash
sudo -u postgres psql
```

### Создайте базу данных и пользователя
```sql
-- Создать базу данных
CREATE DATABASE pyon_db;

-- Создать пользователя
CREATE USER pyon WITH PASSWORD 'ваш_пароль_для_базы';

-- Дать права пользователю
GRANT ALL PRIVILEGES ON DATABASE pyon_db TO pyon;

-- Выйти
\q
```

### Примените схему базы данных
```bash
# Перейти в папку проекта
cd /home/ваш_логин/pyon-studio

# Применить схему
psql -U pyon -d pyon_db -f db/schema.sql
```

---

## 📦 Шаг 4: Установка зависимостей

```bash
# Перейти в папку server
cd /home/ваш_логин/pyon-studio/server

# Установить зависимости
npm install
```

---

## 🚀 Шаг 5: Запуск проекта

### Способ 1: Через ваш скрипт (рекомендуется)
```bash
# Сделать скрипт исполняемым
chmod +x manage.sh

# Запустить скрипт
./manage.sh

# Выбрать пункт 1 (Запустить сервер)
# Затем выбрать 2 (PM2 режим)
```

### Способ 2: Напрямую через PM2
```bash
# Запустить через PM2
npx pm2 start ecosystem.config.js --env production

# Сохранить настройки PM2
npx pm2 save

# Настроить автозапуск
npx pm2 startup
```

---

## 🌐 Шаг 6: Настройка веб-сервера (Nginx)

### Создайте конфигурационный файл
```bash
sudo nano /etc/nginx/sites-available/pyon-studio
```

### Добавьте в файл:
```nginx
server {
    listen 80;
    server_name ваш_домен.com www.ваш_домен.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Активируйте сайт
```bash
# Создать символическую ссылку
sudo ln -s /etc/nginx/sites-available/pyon-studio /etc/nginx/sites-enabled/

# Проверить конфигурацию
sudo nginx -t

# Перезагрузить Nginx
sudo systemctl reload nginx
```

---

## 🔒 Шаг 7: Настройка HTTPS (SSL сертификат)

### Установите Certbot
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

### Получите SSL сертификат
```bash
sudo certbot --nginx -d ваш_домен.com -d www.ваш_домен.com
```

---

## ✅ Шаг 8: Проверка работы

### Проверьте статус PM2
```bash
npx pm2 status
```

### Проверьте логи
```bash
npx pm2 logs
```

### Откройте сайт в браузере
Перейдите по адресу: `https://ваш_домен.com`

---

## 🛠️ Управление проектом

### Основные команды
```bash
# Перейти в папку проекта
cd /home/ваш_логин/pyon-studio/server

# Запустить скрипт управления
./manage.sh

# Или напрямую через PM2:
npx pm2 status          # Статус процессов
npx pm2 logs            # Просмотр логов
npx pm2 restart pyon-studio  # Перезапуск
npx pm2 stop pyon-studio     # Остановка
```

### Обновление проекта
1. Загрузите новые файлы на сервер
2. Перезапустите проект:
   ```bash
   npx pm2 restart pyon-studio
   ```

---

## 🆘 Решение проблем

### Если сайт не открывается:
1. Проверьте статус PM2: `npx pm2 status`
2. Проверьте логи: `npx pm2 logs`
3. Проверьте Nginx: `sudo systemctl status nginx`

### Если база данных не работает:
1. Проверьте подключение: `psql -U pyon -d pyon_db`
2. Проверьте права пользователя в PostgreSQL

### Если порт занят:
```bash
# Найти процесс на порту 3000
sudo lsof -i :3000

# Убить процесс
sudo kill -9 PID_процесса
```

---

## 📞 Поддержка

Если что-то не работает:
1. Проверьте логи: `npx pm2 logs`
2. Проверьте статус: `npx pm2 status`
3. Перезапустите: `npx pm2 restart pyon-studio`

**Важно:** Всегда делайте резервные копии базы данных перед обновлениями!
