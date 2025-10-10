# Wealthify Backend

REST API на **NestJS** c **PostgreSQL** и **Sequelize** для управления пользователями, портфелями и алертами. Документация подключена через Swagger.

## 🔧 Стек

* **NestJS** (HTTP, Guards, Validation)
* **Sequelize** / `sequelize-typescript` (PostgreSQL: `pg`, `pg-hstore`)
* **class-validator** / **class-transformer**
* **@nestjs/jwt**
* **Swagger** (`@nestjs/swagger`, `swagger-ui-express`)
* Тесты: **Jest** / **ts-jest** / **supertest**
* Стиль: **ESLint** + **Prettier**

> Версии см. в `package.json` репозитория.

---

## ✅ Требования

* Node.js LTS
* PostgreSQL 15+ (локально или в Docker)
* npm

---

## 🚀 Быстрый старт (локально)

1. Установка зависимостей (строго по `package-lock.json`):

```bash
npm ci
```

2. Настрой окружение — создайте `.env` в корне (пример ниже).

3. Запуск в dev-режиме:

```bash
npm run start:dev
```

4. Сборка и запуск в prod-режиме:

```bash
npm run build
npm run start
```

---

## 🧩 Переменные окружения

Создайте файл `.env` в корне проекта:

```env
# Common
NODE_ENV=development
PORT=3001

# DB (используйте DATABASE_URL или отдельные поля ниже)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=wealthify
# Альтернатива: единая строка подключения
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wealthify

# Auth/JWT
JWT_SECRET=replace_me_with_strong_secret
JWT_EXPIRES_IN=7d

# CORS (опционально, через запятую)
CORS_ORIGINS=http://localhost:3000
```

> В Docker Compose имена/порты БД могут отличаться — синхронизируйте `DB_HOST` c именем сервиса (`db` и т.п.).

---

## 🗄️ База данных и миграции

* ORM: **Sequelize** + **sequelize-typescript**.
* Подключение через `DATABASE_URL` **или** `DB_*` из `.env`.
* Если используете `sequelize-cli`, добавьте npm-скрипты (и конфиг `sequelize.config.ts`):

```bash
npm run db:migrate
npm run db:seed
npm run db:migrate:undo
```

---

## 🐳 Запуск через Docker Compose

### DEV

```bash
docker compose -f ./docker-compose.dev.yml up -d --build
```

Полезные команды:

```bash
docker compose -f ./docker-compose.dev.yml logs -f api
docker compose -f ./docker-compose.dev.yml logs -f db
docker compose -f ./docker-compose.dev.yml down
# с удалением volume'ов (удалит данные БД)
docker compose -f ./docker-compose.dev.yml down -v
```

### PROD

```bash
docker compose -f ./docker-compose.prod.yml up -d --build
```

Остановить:

```bash
docker compose -f ./docker-compose.prod.yml down
```

---

## 📜 Скрипты npm

```bash
npm ci              # установка зависимостей (по lock-файлу)
npm run lint        # ESLint (и Prettier, если подключён)
npm test            # Jest
npm run test:watch
npm run test:cov
npm run build       # сборка (dist/)
npm start           # prod-режим (node dist/main.js)
npm run start:dev   # dev-режим (watch)
```

---

## 📘 Swagger (API Docs)

После запуска проверь адрес (порт из `.env`):

```
http://localhost:3001/api/docs
```

---

## 🔐 Безопасность

* Используй длинный и уникальный `JWT_SECRET`.
* В проде включай CORS по списку доменов (`CORS_ORIGINS`).
* Секреты — только через переменные окружения/секрет-менеджер.
* Логи без чувствительных данных.

---

## 🧰 Траблшутинг

* **API не видит БД в Docker:** совпадает ли `DB_HOST` с именем сервиса в compose (например, `db`)? Доступен ли порт?
* **Миграции не применяются:** проверь `sequelize-cli` и конфиг подключения (та же строка, что и у рантайма).
* **Порт занят:** поменяй `PORT` в `.env` или в compose-файле.
* **Swagger 404:** проверь `main.ts` (путь `setupSwagger` и глобальный префикс).
