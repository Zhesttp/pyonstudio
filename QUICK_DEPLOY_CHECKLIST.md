# ✅ Чек-лист развертывания на Hoster.by

## 🎯 **БЫСТРЫЙ СТАРТ**

### **1. ПОДГОТОВКА (5 минут)**
- [ ] Создан сервер в панели hoster.by
- [ ] Получены данные для SSH подключения
- [ ] Домен привязан к серверу
- [ ] SSL сертификат активирован

### **2. ПОДКЛЮЧЕНИЕ И УСТАНОВКА (15 минут)**
```bash
# Подключение
ssh root@your-server-ip

# Установка пакетов
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs mysql-server nginx git
sudo npm install -g pm2
```

### **3. НАСТРОЙКА БД (5 минут)**
```bash
sudo mysql_secure_installation
sudo mysql -u root -p
```
```sql
CREATE DATABASE pyon_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pyon'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON pyon_db.* TO 'pyon'@'localhost';
GRANT SUPER ON *.* TO 'pyon'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### **4. РАЗВЕРТЫВАНИЕ ПРОЕКТА (10 минут)**
```bash
cd /var/www
sudo git clone https://github.com/Zhesttp/pyonstudio.git
sudo chown -R $USER:$USER /var/www/pyonstudio
cd pyonstudio/server
npm install
```

### **5. НАСТРОЙКА ОКРУЖЕНИЯ (3 минуты)**
```bash
nano .env
```
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=pyon
DB_PASSWORD=your_password
DB_NAME=pyon_db
JWT_SECRET=your_jwt_secret
NODE_ENV=production
PORT=3000
```

### **6. ПРИМЕНЕНИЕ СХЕМЫ БД (2 минуты)**
```bash
mysql -u pyon -p pyon_db < ../db/schema.sql
```

### **7. СОЗДАНИЕ АДМИНА (2 минуты)**
```bash
./manage.sh
# Выберите пункт 8
```

### **8. НАСТРОЙКА NGINX (5 минут)**
```bash
sudo nano /etc/nginx/sites-available/pyonstudio
```
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        root /var/www/pyonstudio;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pyonstudio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### **9. ЗАПУСК ПРИЛОЖЕНИЯ (2 минуты)**
```bash
npm run pm2:start
pm2 save
pm2 startup
```

### **10. ПРОВЕРКА (3 минуты)**
- [ ] Сайт доступен: https://your-domain.com
- [ ] API работает: https://your-domain.com/api/health
- [ ] Админ-панель: https://your-domain.com/admin.html
- [ ] Можно войти как админ

---

## 🚨 **ЕСЛИ ЧТО-ТО НЕ РАБОТАЕТ**

### **Проверьте логи:**
```bash
npm run pm2:logs
sudo tail -f /var/log/nginx/error.log
```

### **Проверьте статус:**
```bash
npm run pm2:status
sudo systemctl status nginx
sudo systemctl status mysql
```

### **Перезапустите:**
```bash
npm run pm2:restart
sudo systemctl restart nginx
```

---

## 📞 **ПОДДЕРЖКА**

- **Hoster.by:** support@hoster.by, +375 (17) 239-57-02
- **Документация:** https://hoster.by/help/

**Время развертывания: ~45 минут** ⏱️
