# 🚀 Развертывание на Hoster.by

## 📋 Пошаговая инструкция

### **1. ПОДКЛЮЧЕНИЕ К ХОСТИНГУ**

1. **Войдите в панель управления** hoster.by
2. **Перейдите в раздел "Облачные серверы"** или "VPS"
3. **Создайте новый сервер** с характеристиками:
   - **ОС:** Ubuntu 20.04+ или CentOS 8+
   - **RAM:** минимум 2GB
   - **CPU:** 2 ядра
   - **Диск:** 20GB SSD

### **2. ПОДКЛЮЧЕНИЕ ПО SSH**

```bash
ssh root@your-server-ip
# или
ssh username@your-server-ip
```

### **3. УСТАНОВКА НЕОБХОДИМЫХ ПАКЕТОВ**

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка MySQL
sudo apt install mysql-server -y

# Установка Nginx
sudo apt install nginx -y

# Установка PM2 глобально
sudo npm install -g pm2

# Установка Git
sudo apt install git -y
```

### **4. НАСТРОЙКА MYSQL**

```bash
# Запуск MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# Безопасная настройка
sudo mysql_secure_installation

# Создание базы данных
sudo mysql -u root -p
```

В MySQL выполните:
```sql
CREATE DATABASE pyon_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pyon'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON pyon_db.* TO 'pyon'@'localhost';
GRANT SUPER ON *.* TO 'pyon'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### **5. КЛОНИРОВАНИЕ ПРОЕКТА**

```bash
# Создание директории
sudo mkdir -p /var/www
cd /var/www

# Клонирование репозитория
sudo git clone https://github.com/Zhesttp/pyonstudio.git
sudo chown -R $USER:$USER /var/www/pyonstudio
cd pyonstudio/server
```

### **6. НАСТРОЙКА ПРОЕКТА**

```bash
# Установка зависимостей
npm install

# Создание .env файла
nano .env
```

Содержимое `.env`:
```env
# База данных
DB_HOST=localhost
DB_PORT=3306
DB_USER=pyon
DB_PASSWORD=your_strong_password
DB_NAME=pyon_db

# JWT секрет (сгенерируйте случайную строку)
JWT_SECRET=your_very_long_random_jwt_secret_key_here

# Режим работы
NODE_ENV=production

# Порт сервера
PORT=3000

# Домен сайта (для уведомлений)
DOMAIN=https://your-domain.com

# Telegram Bot настройки
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
```

### **7. ПРИМЕНЕНИЕ СХЕМЫ БД**

```bash
# Применение схемы
mysql -u pyon -p pyon_db < ../db/schema.sql
```

### **8. СОЗДАНИЕ АДМИНА**

```bash
# Использование скрипта управления
./manage.sh
# Выберите пункт 8 - "Добавить/обновить админа"
```

### **9. НАСТРОЙКА NGINX**

```bash
# Создание конфигурации
sudo nano /etc/nginx/sites-available/pyonstudio
```

Содержимое конфигурации:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Статические файлы
    location / {
        root /var/www/pyonstudio;
        try_files $uri $uri/ /index.html;
    }
    
    # API запросы
    location /api/ {
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

```bash
# Активация сайта
sudo ln -s /etc/nginx/sites-available/pyonstudio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### **10. НАСТРОЙКА SSL**

В панели hoster.by:
1. **Перейдите в раздел "SSL-сертификаты"**
2. **Активируйте SSL** для вашего домена
3. **Обновите конфигурацию Nginx:**

```bash
sudo nano /etc/nginx/sites-available/pyonstudio
```

Добавьте SSL конфигурацию:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL сертификаты (пути укажет hoster.by)
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Остальная конфигурация...
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### **11. ЗАПУСК ПРИЛОЖЕНИЯ**

```bash
# Запуск через PM2
cd /var/www/pyonstudio/server
npm run pm2:start

# Сохранение конфигурации
pm2 save
pm2 startup

# Проверка статуса
npm run pm2:status
```

### **12. НАСТРОЙКА ФАЙРВОЛА**

```bash
# Настройка UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 🔧 **ОСОБЕННОСТИ HOSTER.BY**

### **Управление через панель:**
1. **Мониторинг сервера** - в панели hoster.by
2. **Резервное копирование** - автоматическое
3. **SSL сертификаты** - управление через панель
4. **Домены** - привязка через панель

### **Полезные команды:**
```bash
# Перезапуск приложения
npm run pm2:restart

# Просмотр логов
npm run pm2:logs

# Мониторинг
npm run pm2:monit

# Остановка
npm run pm2:stop
```

---

## 🚨 **УСТРАНЕНИЕ НЕПОЛАДОК**

### **Проблемы с доступом:**
1. **Проверьте статус сервера** в панели hoster.by
2. **Проверьте файрвол:** `sudo ufw status`
3. **Проверьте Nginx:** `sudo systemctl status nginx`

### **Проблемы с приложением:**
```bash
# Проверка логов
npm run pm2:logs

# Перезапуск
npm run pm2:restart

# Проверка портов
netstat -tlnp | grep :3000
```

### **Проблемы с БД:**
```bash
# Проверка MySQL
sudo systemctl status mysql

# Подключение к БД
mysql -u pyon -p pyon_db
```

---

## 📞 **ПОДДЕРЖКА HOSTER.BY**

- **Техподдержка:** support@hoster.by
- **Телефон:** +375 (17) 239-57-02
- **Документация:** https://hoster.by/help/

---

## ✅ **ПРОВЕРКА РАБОТОСПОСОБНОСТИ**

После развертывания проверьте:
1. **Сайт доступен:** https://your-domain.com
2. **API работает:** https://your-domain.com/api/health
3. **Админ-панель:** https://your-domain.com/admin.html
4. **База данных** подключена

**Успешного развертывания! 🎉**
