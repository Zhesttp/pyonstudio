# 🚀 Руководство по развертыванию на хостинге

## 📋 Требования к хостингу

### **Минимальные требования:**
- **Node.js** версии 18+ 
- **MySQL** версии 8.0+
- **Nginx** (рекомендуется)
- **PM2** для управления процессами
- **SSL сертификат** (Let's Encrypt или купленный)

### **Рекомендуемые характеристики:**
- **RAM:** 2GB+ 
- **CPU:** 2 ядра+
- **Диск:** 20GB+ SSD
- **Пропускная способность:** безлимитная

---

## 🔧 Пошаговая инструкция

### **1. ПОДКЛЮЧЕНИЕ К СЕРВЕРУ**

```bash
# Подключение по SSH
ssh root@your-server-ip

# Или если используете пользователя
ssh username@your-server-ip
```

### **2. УСТАНОВКА НЕОБХОДИМЫХ ПАКЕТОВ**

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

### **3. НАСТРОЙКА MYSQL**

```bash
# Запуск MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# Безопасная настройка MySQL
sudo mysql_secure_installation

# Создание базы данных и пользователя
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

### **4. КЛОНИРОВАНИЕ ПРОЕКТА**

```bash
# Создание директории для проекта
sudo mkdir -p /var/www
cd /var/www

# Клонирование репозитория
sudo git clone https://github.com/Zhesttp/pyonstudio.git
sudo chown -R $USER:$USER /var/www/pyonstudio
cd pyonstudio
```

### **5. НАСТРОЙКА ПРОЕКТА**

```bash
# Установка зависимостей
cd server
npm install

# Создание .env файла
nano .env
```

Содержимое `.env` файла:
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
```

### **6. ПРИМЕНЕНИЕ СХЕМЫ БД**

```bash
# Применение схемы базы данных
mysql -u pyon -p pyon_db < ../db/schema.sql
```

### **7. СОЗДАНИЕ АДМИНА**

```bash
# Использование скрипта управления
./manage.sh
# Выберите пункт 8 - "Добавить/обновить админа"
```

### **8. НАСТРОЙКА NGINX**

```bash
# Создание конфигурации сайта
sudo nano /etc/nginx/sites-available/pyonstudio
```

Содержимое конфигурации:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL сертификаты
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
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
    
    # Заголовки безопасности
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

```bash
# Активация сайта
sudo ln -s /etc/nginx/sites-available/pyonstudio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### **9. НАСТРОЙКА SSL (Let's Encrypt)**

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение сертификата
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Автоматическое обновление
sudo crontab -e
# Добавьте строку:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### **10. ЗАПУСК ПРИЛОЖЕНИЯ**

```bash
# Запуск через PM2
cd /var/www/pyonstudio/server
pm2 start app.js --name pyonstudio

# Сохранение конфигурации PM2
pm2 save
pm2 startup

# Проверка статуса
pm2 status
pm2 logs pyonstudio
```

### **11. НАСТРОЙКА ФАЙРВОЛА**

```bash
# Настройка UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 🔍 ПРОВЕРКА РАБОТОСПОСОБНОСТИ

### **Тестирование API:**
```bash
# Проверка API
curl https://your-domain.com/api/health

# Проверка базы данных
mysql -u pyon -p pyon_db -e "SHOW TABLES;"
```

### **Мониторинг:**
```bash
# Статус PM2
pm2 status

# Логи приложения
pm2 logs pyonstudio

# Мониторинг ресурсов
pm2 monit
```

---

## 🛠️ УПРАВЛЕНИЕ

### **Обновление приложения:**
```bash
cd /var/www/pyonstudio
git pull origin main
cd server
npm install
pm2 restart pyonstudio
```

### **Резервное копирование БД:**
```bash
# Создание бэкапа
mysqldump -u pyon -p pyon_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановление
mysql -u pyon -p pyon_db < backup_file.sql
```

### **Логи и мониторинг:**
```bash
# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Логи PM2
pm2 logs pyonstudio

# Системные ресурсы
htop
df -h
```

---

## 🚨 УСТРАНЕНИЕ НЕПОЛАДОК

### **Проблемы с базой данных:**
```bash
# Проверка статуса MySQL
sudo systemctl status mysql

# Перезапуск MySQL
sudo systemctl restart mysql

# Проверка подключения
mysql -u pyon -p pyon_db -e "SELECT 1;"
```

### **Проблемы с приложением:**
```bash
# Перезапуск PM2
pm2 restart pyonstudio

# Просмотр логов
pm2 logs pyonstudio --lines 100

# Проверка портов
netstat -tlnp | grep :3000
```

### **Проблемы с Nginx:**
```bash
# Проверка конфигурации
sudo nginx -t

# Перезапуск Nginx
sudo systemctl restart nginx

# Проверка статуса
sudo systemctl status nginx
```

---

## 📞 ПОДДЕРЖКА

При возникновении проблем:
1. Проверьте логи: `pm2 logs pyonstudio`
2. Проверьте статус сервисов: `pm2 status`, `sudo systemctl status nginx`
3. Проверьте подключение к БД: `mysql -u pyon -p pyon_db`
4. Проверьте конфигурацию Nginx: `sudo nginx -t`

**Успешного развертывания! 🎉**
