# YourPet

Веб-сервис для совместного ухода за домашними питомцами.

## Стек

- **Backend:** Node.js, Express, PostgreSQL, JWT
- **Frontend:** React, Vite, React Router
- **БД:** PostgreSQL (локально через Docker)

## Быстрый старт

### 1. PostgreSQL

**Вариант A — Docker:**

```bash
docker compose up -d
```

**Вариант B — локальный PostgreSQL (Windows):**

1. Установите [PostgreSQL](https://www.postgresql.org/download/windows/)
2. Создайте пользователя и базу:

```bash
psql -U postgres -f backend/scripts/setup-db.sql
```

3. Проверьте `DATABASE_URL` в `backend/.env` (по умолчанию `postgresql://yourpet:yourpet@localhost:5432/yourpet`)

### 2. Установка и запуск

**Один раз — установить зависимости:**

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
npm install
npm run db:init --prefix backend
```

**Запуск frontend + backend одной командой (удобнее всего):**

```bash
npm run dev
```

- Backend: http://localhost:3001  
- Frontend: http://localhost:5173  

**С телефона в той же Wi‑Fi:** в терминале Vite будет строка `Network: http://192.168.x.x:5173` — откройте её на телефоне.

**Или в двух отдельных терминалах:**

```bash
# Терминал 1
cd backend
npm run dev

# Терминал 2
cd frontend
npm run dev
```

### 2a. Backend (отдельно)

```bash
cd backend
copy .env.example .env
npm install
npm run db:init
npm run dev
```

API: http://localhost:3001

### 3. Frontend (отдельно)

```bash
cd frontend
npm install
npm run dev
```

Сайт: http://localhost:5173

## Функционал

### Free
- 1 питомец
- Дневник здоровья (симптомы, визиты, заметки)
- Напоминания (прививки, обработки)
- Загрузка документов

### Premium
- Неограниченное число питомцев
- Семейный доступ (до 5 человек)
- Коллективный календарь задач
- Приглашения по email
- Демо-оплата подписки

## Структура

```
backend/     — REST API
frontend/    — React SPA
docker-compose.yml — PostgreSQL
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/auth/register | Регистрация |
| POST | /api/auth/login | Вход |
| GET | /api/pets | Список питомцев |
| POST | /api/pets/:id/diary | Запись в дневник |
| POST | /api/subscription/subscribe | Оформить Premium |

Полный список — в исходниках `backend/src/routes/`.
