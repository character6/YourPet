# Деплой YourPet на VPS — пошаговый план

Подробная инструкция по развёртыванию приложения **YourPet** на виртуальном сервере (VPS) с доменом, HTTPS и автозапуском.

---

## Содержание

1. [Что будет в итоге](#1-что-будет-в-итоге)
2. [Что понадобится заранее](#2-что-понадобится-заранее)
3. [Архитектура production](#3-архитектура-production)
4. [Шаг 1 — Настройка DNS](#шаг-1--настройка-dns)
5. [Шаг 2 — Первый вход на сервер](#шаг-2--первый-вход-на-сервер)
6. [Шаг 3 — Базовая настройка Ubuntu](#шаг-3--базовая-настройка-ubuntu)
7. [Шаг 4 — Установка Node.js](#шаг-4--установка-nodejs)
8. [Шаг 5 — Установка PostgreSQL](#шаг-5--установка-postgresql)
9. [Шаг 6 — Загрузка кода на сервер](#шаг-6--загрузка-кода-на-сервер)
10. [Шаг 7 — Настройка backend (.env)](#шаг-7--настройка-backend-env)
11. [Шаг 8 — Установка зависимостей и БД](#шаг-8--установка-зависимостей-и-бд)
12. [Шаг 9 — Сборка frontend](#шаг-9--сборка-frontend)
13. [Шаг 10 — Запуск backend через PM2](#шаг-10--запуск-backend-через-pm2)
14. [Шаг 11 — Nginx (сайт + прокси API)](#шаг-11--nginx-сайт--прокси-api)
15. [Шаг 12 — SSL-сертификат (HTTPS)](#шаг-12--ssl-сертификат-https)
16. [Шаг 13 — Проверка после деплоя](#шаг-13--проверка-после-деплоя)
17. [Шаг 14 — Резервное копирование](#шаг-14--резервное-копирование)
18. [Шаг 15 — Обновление сайта](#шаг-15--обновление-сайта)
19. [Безопасность](#безопасность)
20. [Частые проблемы](#частые-проблемы)

---

## 1. Что будет в итоге

После выполнения всех шагов:

| Компонент | Где работает |
|-----------|--------------|
| Сайт (React) | `https://yourpet-tp.ru` — отдаёт Nginx из папки `frontend/dist` |
| API (Node.js) | `https://yourpet-tp.ru/api/...` — Nginx проксирует на `localhost:3001` |
| База данных | PostgreSQL на том же VPS |
| Загрузки (фото, документы) | Папка `backend/uploads/` на диске сервера |
| Автозапуск backend | PM2 (перезапуск при падении и после перезагрузки сервера) |
| HTTPS | Бесплатный сертификат Let's Encrypt (Certbot) |

**Пример для этого проекта:**
- Домен: `yourpet-tp.ru`
- IP VPS: `77.232.135.9`

---

## 2. Что понадобится заранее

- [ ] VPS с Ubuntu 22.04 или 24.04 (минимум **1 GB RAM**, лучше 2 GB)
- [ ] Доступ по SSH (логин `root` или обычный пользователь с `sudo`)
- [ ] Зарегистрированный домен (`yourpet-tp.ru`)
- [ ] Доступ к панели DNS у регистратора домена
- [ ] Репозиторий с кодом на GitHub / GitLab (или возможность загрузить файлы через SFTP)
- [ ] 30–60 минут времени

**Стек проекта:**
- Backend: Node.js + Express, порт `3001`
- Frontend: React + Vite (в production — статические файлы после `npm run build`)
- БД: PostgreSQL

---

## 3. Архитектура production

```
Пользователь
    │
    ▼
https://yourpet-tp.ru  ──►  Nginx :443
    │                           │
    │                           ├── /          → frontend/dist (HTML, JS, CSS)
    │                           └── /api/*     → http://127.0.0.1:3001 (Node.js)
    │
    ▼
PostgreSQL :5432 (только localhost)
backend/uploads/ (фото питомцев, документы)
```

**Важно:** в development frontend ходит на `/api` через прокси Vite. На сервере ту же роль выполняет Nginx — менять код frontend не нужно.

---

## Шаг 1 — Настройка DNS

Зайдите в панель управления доменом (Reg.ru, Timeweb, Cloudflare и т.д.) и создайте записи:

| Тип | Имя (Host) | Значение | TTL |
|-----|------------|----------|-----|
| **A** | `@` | `77.232.135.9` | 300–3600 |
| **A** | `www` | `77.232.135.9` | 300–3600 |

### Проверка (с вашего компьютера)

```bash
# Windows PowerShell
nslookup yourpet-tp.ru
nslookup www.yourpet-tp.ru
```

Оба запроса должны вернуть IP `77.232.135.9`.

> **Примечание:** распространение DNS может занять от 5 минут до 24–48 часов. SSL-сертификат (шаг 12) выдавайте только когда DNS уже указывает на VPS.

---

## Шаг 2 — Первый вход на сервер

### Windows (PowerShell)

```powershell
ssh root@77.232.135.9
```

Или, если создан отдельный пользователь:

```powershell
ssh deploy@77.232.135.9
```

При первом подключении подтвердите отпечаток сервера (`yes`), введите пароль или используйте SSH-ключ.

---

## Шаг 3 — Базовая настройка Ubuntu

Выполните на сервере:

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Базовые утилиты
sudo apt install -y curl git ufw nginx

# Файрвол: SSH + HTTP + HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

### (Рекомендуется) Отдельный пользователь для деплоя

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy

# Переключиться на него (если заходили как root)
su - deploy
```

Дальнейшие команды можно выполнять от пользователя `deploy`.

---

## Шаг 4 — Установка Node.js

Установите **Node.js 20 LTS** (рекомендуется для этого проекта):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node -v    # v20.x.x
npm -v
```

Установите **PM2** — менеджер процессов для backend:

```bash
sudo npm install -g pm2
```

---

## Шаг 5 — Установка PostgreSQL

### Вариант A — PostgreSQL напрямую (рекомендуется для VPS)

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Создайте пользователя и базу:

```bash
sudo -u postgres psql
```

В консоли PostgreSQL:

```sql
CREATE USER yourpet WITH PASSWORD 'ЗАМЕНИТЕ_НА_СЛОЖНЫЙ_ПАРОЛЬ';
CREATE DATABASE yourpet OWNER yourpet;
GRANT ALL PRIVILEGES ON DATABASE yourpet TO yourpet;
\q
```

Строка подключения для `.env`:

```
postgresql://yourpet:ЗАМЕНИТЕ_НА_СЛОЖНЫЙ_ПАРОЛЬ@localhost:5432/yourpet
```

### Вариант B — PostgreSQL через Docker

Если на сервере уже установлен Docker:

```bash
sudo apt install -y docker.io docker-compose-plugin
cd /var/www/yourpet
docker compose up -d
```

Используйте `DATABASE_URL` из `docker-compose.yml`:

```
postgresql://yourpet:yourpet@localhost:5432/yourpet
```

> Для production лучше сменить пароль в `docker-compose.yml` на сложный и не открывать порт `5432` наружу.

---

## Шаг 6 — Загрузка кода на сервер

### Вариант A — через Git (предпочтительно)

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www

git clone https://github.com/ВАШ_АККАУНТ/YourPet.git yourpet
cd yourpet
```

### Вариант B — через SFTP

1. Подключитесь FileZilla / WinSCP к серверу.
2. Загрузите папку проекта в `/var/www/yourpet`.
3. **Не загружайте** `node_modules`, `.env` с локального компьютера и папку `uploads` (если там тестовые файлы).

---

## Шаг 7 — Настройка backend (.env)

```bash
cd /var/www/yourpet/backend
cp .env.example .env
nano .env
```

Пример **production** конфигурации:

```env
HOST=127.0.0.1
PORT=3001

DATABASE_URL=postgresql://yourpet:ВАШ_СЛОЖНЫЙ_ПАРОЛЬ@localhost:5432/yourpet

JWT_SECRET=сгенерируйте-длинную-случайную-строку-минимум-32-символа
JWT_EXPIRES_IN=7d

UPLOAD_DIR=/var/www/yourpet/backend/uploads

FRONTEND_URL=https://yourpet-tp.ru
```

### Как сгенерировать JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Важные параметры

| Переменная | Зачем нужна |
|------------|-------------|
| `HOST=127.0.0.1` | Backend слушает только localhost — снаружи доступ только через Nginx |
| `FRONTEND_URL` | CORS и **реферальные ссылки** (`/invite/...`) — обязательно `https://yourpet-tp.ru` |
| `UPLOAD_DIR` | Абсолютный путь к папке загрузок (фото и документы) |
| `JWT_SECRET` | Уникальный секрет; **никогда** не коммитьте в Git |

Создайте папку для загрузок:

```bash
mkdir -p /var/www/yourpet/backend/uploads/pets
chmod 755 /var/www/yourpet/backend/uploads
```

---

## Шаг 8 — Установка зависимостей и БД

```bash
cd /var/www/yourpet/backend
npm install --omit=dev

# Первичная инициализация схемы БД (только один раз на чистой базе)
npm run db:init

# Миграции (если база уже была — или после обновлений)
npm run db:migrate
```

**Ожидаемый результат:**
- `Database schema initialized.` — при первом `db:init`
- `Database migration completed.` — при `db:migrate`

Если `db:init` выдаёт ошибку «relation already exists» — база уже инициализирована, достаточно `db:migrate`.

---

## Шаг 9 — Сборка frontend

```bash
cd /var/www/yourpet/frontend
npm install
npm run build
```

Появится папка `frontend/dist` — её будет отдавать Nginx.

Проверка локально на сервере (опционально):

```bash
npm run preview -- --host 127.0.0.1 --port 4173
# Ctrl+C для выхода
```

---

## Шаг 10 — Запуск backend через PM2

```bash
cd /var/www/yourpet/backend
pm2 start src/index.js --name yourpet-api
pm2 save
pm2 startup
```

Команда `pm2 startup` выведет строку вида `sudo env PATH=...` — **скопируйте и выполните её**, чтобы backend стартовал после перезагрузки сервера.

### Полезные команды PM2

```bash
pm2 status              # статус
pm2 logs yourpet-api    # логи
pm2 restart yourpet-api # перезапуск
pm2 stop yourpet-api     # остановка
```

### Проверка API

```bash
curl http://127.0.0.1:3001/api/health
```

Ожидаемый ответ:

```json
{"status":"ok","service":"YourPet API"}
```

---

## Шаг 11 — Nginx (сайт + прокси API)

Создайте конфиг сайта:

```bash
sudo nano /etc/nginx/sites-available/yourpet
```

Вставьте (замените домен при необходимости):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourpet-tp.ru www.yourpet-tp.ru;

    root /var/www/yourpet/frontend/dist;
    index index.html;

    # Загрузка файлов до 10 MB (документы питомцев)
    client_max_body_size 10M;

    # API → Node.js backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # React Router — все неизвестные пути → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэш статики
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}
```

Активируйте сайт и перезапустите Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/yourpet /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Откройте в браузере: `http://yourpet-tp.ru` — должен открыться сайт (пока без HTTPS).

---

## Шаг 12 — SSL-сертификат (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourpet-tp.ru -d www.yourpet-tp.ru
```

Certbot:
1. Запросит email для уведомлений.
2. Согласие с условиями.
3. Предложит редирект HTTP → HTTPS — **выберите редирект (рекомендуется)**.

После успеха сайт будет доступен по `https://yourpet-tp.ru`.

### Автопродление сертификата

```bash
sudo certbot renew --dry-run
```

Certbot добавляет задачу в cron/systemd timer автоматически.

### Обновите FRONTEND_URL

Убедитесь, что в `backend/.env`:

```env
FRONTEND_URL=https://yourpet-tp.ru
```

Перезапустите backend:

```bash
pm2 restart yourpet-api
```

Без этого реферальные ссылки могут указывать на `http://localhost:5173`, а CORS заблокирует запросы.

---

## Шаг 13 — Проверка после деплоя

### Чеклист

- [ ] `https://yourpet-tp.ru` открывается без ошибок
- [ ] Регистрация нового аккаунта работает
- [ ] Вход / выход работает
- [ ] Создание питомца, дневник, напоминания
- [ ] Загрузка фото и документов
- [ ] Страница `/invites` — реферальная ссылка начинается с `https://yourpet-tp.ru/invite/...`
- [ ] Кнопка «Копировать» на странице приглашений работает (HTTPS = secure context)
- [ ] Premium / PDF-отчёт (если используете)
- [ ] `curl https://yourpet-tp.ru/api/health` → `{"status":"ok",...}`

### Просмотр логов при ошибках

```bash
pm2 logs yourpet-api --lines 100
sudo tail -f /var/log/nginx/error.log
```

---

## Шаг 14 — Резервное копирование

### База данных

```bash
# Создать бэкап
pg_dump -U yourpet -h localhost yourpet > ~/backup-yourpet-$(date +%Y%m%d).sql

# Восстановить (осторожно — перезапишет данные)
psql -U yourpet -h localhost yourpet < ~/backup-yourpet-20260530.sql
```

### Загрузки (фото, документы)

```bash
tar -czf ~/uploads-backup-$(date +%Y%m%d).tar.gz -C /var/www/yourpet/backend uploads
```

### Автоматический бэкап (cron, раз в сутки)

```bash
crontab -e
```

Добавьте строку:

```cron
0 3 * * * pg_dump -U yourpet -h localhost yourpet > /home/deploy/backups/db-$(date +\%Y\%m\%d).sql
```

Создайте папку `~/backups` заранее.

---

## Шаг 15 — Обновление сайта

После изменений в коде (git push с вашего компьютера):

```bash
cd /var/www/yourpet
git pull

# Backend
cd backend
npm install --omit=dev
npm run db:migrate
pm2 restart yourpet-api

# Frontend
cd ../frontend
npm install
npm run build

# Nginx подхватит новый dist автоматически
sudo nginx -t && sudo systemctl reload nginx
```

---

## Безопасность

| Рекомендация | Действие |
|--------------|----------|
| Сложные пароли | PostgreSQL, SSH, JWT_SECRET |
| Не открывать PostgreSQL наружу | Слушает только `127.0.0.1:5432` |
| Backend только на localhost | `HOST=127.0.0.1` в `.env` |
| Файрвол | UFW: только 22, 80, 443 |
| SSH-ключи | Отключить вход по паролю для root (после настройки ключей) |
| `.env` не в Git | Проверьте, что `backend/.env` в `.gitignore` |
| Регулярные обновления | `sudo apt update && sudo apt upgrade` |

---

## Частые проблемы

### «Сервер недоступен» на сайте

1. `pm2 status` — процесс `yourpet-api` должен быть `online`.
2. `curl http://127.0.0.1:3001/api/health` на сервере.
3. Проверьте конфиг Nginx: `sudo nginx -t`.

### CORS: доступ с этого адреса запрещён

В `backend/.env` должно быть:

```env
FRONTEND_URL=https://yourpet-tp.ru
```

Без слэша в конце. После изменения: `pm2 restart yourpet-api`.

### Реферальная ссылка ведёт на localhost

Та же причина — неверный `FRONTEND_URL`. Исправьте и перезапустите backend.

### 502 Bad Gateway

Backend не запущен или упал. Смотрите `pm2 logs yourpet-api`.

### Белый экран / 404 на `/pets/...`

Nginx не настроен на SPA. Нужен блок:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Ошибка при загрузке файла

- Проверьте права на `backend/uploads`: пользователь, от которого работает PM2, должен иметь запись.
- В Nginx: `client_max_body_size 10M;`

### Certbot не выдаёт сертификат

- DNS ещё не обновился — подождите и проверьте `nslookup yourpet-tp.ru`.
- Порт 80 должен быть открыт: `sudo ufw allow 'Nginx Full'`.

### База данных: connection refused

```bash
sudo systemctl status postgresql
```

Проверьте `DATABASE_URL` в `.env`.

---

## Краткая шпаргалка команд

```bash
# Статус всего
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql

# Перезапуск
pm2 restart yourpet-api
sudo systemctl reload nginx

# Логи
pm2 logs yourpet-api
sudo tail -f /var/log/nginx/error.log

# Health check
curl -s https://yourpet-tp.ru/api/health
```

---

## Структура файлов на сервере

```
/var/www/yourpet/
├── backend/
│   ├── src/
│   ├── uploads/          ← фото и документы (бэкапить!)
│   ├── .env              ← секреты (не в Git)
│   └── package.json
├── frontend/
│   └── dist/             ← собранный сайт для Nginx
├── docker-compose.yml    ← опционально, если БД в Docker
└── DEPLOY.md             ← этот файл
```

---

*Документ составлен для проекта YourPet (Node.js + React + PostgreSQL). Домен и IP в примерах: `yourpet-tp.ru`, `77.232.135.9` — замените на свои при необходимости.*
