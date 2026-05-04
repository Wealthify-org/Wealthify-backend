# Wealthify — Backend

NestJS-монорепо: 7 микросервисов, общающихся через RabbitMQ, общая Postgres-БД,
HTTP-шлюз на :5001 с Swagger-документацией.

## Стек

- **Node 20**, **NestJS 11**, **TypeScript**
- **Postgres 16** + Sequelize-typescript
- **RabbitMQ 3** (RPC между микросервисами)
- **Puppeteer** для парсинга крипто-данных с CoinGecko (через прокси-пул)
- **Docker Compose** для локальной разработки

## Микросервисы

| App | Роль | Порт |
|---|---|---|
| `api-gateway` | Единственный HTTP-вход. Swagger на `/api/docs`. | 5001 |
| `identity` | Auth, users, roles, JWT, refresh-tokens, чат-история. | RPC |
| `assets` | Каталог активов. | RPC |
| `portfolio-core` | Портфели, позиции, транзакции. | RPC |
| `crypto-data-worker` | Парсер CoinGecko (Puppeteer + прокси). | RPC |
| `indexes-data-worker` | Fear & Greed, Dominance, market caps. | RPC |
| `stock-data-worker` | Биржевые индексы (S&P, gold). | RPC |

## Быстрый старт через Docker

### 1. Клонировать оба репо рядом

```bash
mkdir wealthify && cd wealthify
git clone <Wealthify-backend-url>  # текущий репо
git clone <wealthify-web-url>      # фронтенд
```

Структура должна быть такой:

```
wealthify/
├── Wealthify-backend/   ← вы здесь
└── wealthify-web/       ← фронтенд (см. его README)
```

### 2. Поднять стек одной командой

Из папки `Wealthify-backend/`:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Compose поднимет:
- `postgres` (Postgres 16) на `:5432`
- `rabbitmq` (с UI на `:15672`, логин `guest/guest`)
- 7 микросервисов
- `web` — Next.js фронт на `:3000` (бэк-репо собирает фронт-контейнер)

### 3. Подождать первой инициализации

При первом запуске Postgres выполнит `db/seed.sql.gz` — занимает 1-2 минуты:

```bash
docker compose -f docker-compose.dev.yml logs -f postgres
```

Когда увидите `database system is ready to accept connections` (после фразы
`PostgreSQL init process complete`), БД готова.

После этого микросервисы автоматически дойдут до healthy и подключатся к
RabbitMQ. Можно следить за всеми логами:

```bash
docker compose -f docker-compose.dev.yml logs -f
```

### 4. Открыть приложение

- Frontend: http://localhost:3000
- API Gateway: http://localhost:5001
- Swagger: http://localhost:5001/api/docs
- RabbitMQ UI: http://localhost:15672 (`guest` / `guest`)

## Что в seed-дампе

`db/seed.sql.gz` (≈15 МБ сжатый, 42 МБ распакованный) содержит:

- Полную схему всех таблиц
- Каталог криптоактивов (≈110 монет с метаданными, логотипами, графиками
  цен за 1d/7d/30d/90d/1y/max)
- Снэпшоты индексов (Fear & Greed, Dominance, market caps)
- Базовые роли (`USER`, `ADMIN`)

**НЕ содержит** реальных пользователей, портфелей, транзакций — после первого
запуска вы регистрируетесь свежим аккаунтом и работаете с нуля.

## Что произойдёт после старта

- **Crypto-data-worker** имеет cron, парсящий CoinGecko каждые 10 секунд
  (`apps/crypto-data-worker/src/crypto-data-scrapper.service.ts:96`). Лимит на
  парсер — 2050 топ-монет, полный цикл занимает ~3-4 часа. Каталог из seed'а
  будет обновляться, новые монеты добавляться.
- **Indexes/Stock workers** обновляют свои индексы по собственным расписаниям.
- Если **прокси не настроены** или невалидны (`CRYPTO_SCRAPER_PROXIES` в
  `.development.env`), парсер упрётся в rate-limit CoinGecko. Каталог из
  seed'а останется, но новых обновлений не будет.

## Полезные команды

```bash
# Перезапустить один микросервис (например после правки кода)
docker compose -f docker-compose.dev.yml restart api-gateway

# Сбросить БД к seed'у (полная очистка volume'а):
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d --build

# Зайти в Postgres напрямую:
docker exec -it wealthify-postgres-dev psql -U postgres -d wealthify

# Остановить всё:
docker compose -f docker-compose.dev.yml down
```

## Без Docker (локально)

Понадобятся:
- Postgres 16 на `localhost:5432` (БД `wealthify`, юзер `postgres`, пароль `root`)
- RabbitMQ на `localhost:5672` (`guest/guest`)
- Файл `.development.env` (есть пример в репо)
- `npm ci && npm run dev` — поднимает все 7 микросервисов параллельно через
  `concurrently`

Залить seed вручную в локальный Postgres:

```bash
gunzip -c db/seed.sql.gz | psql -h localhost -U postgres -d wealthify
```

## Архитектура (короче)

- Gateway — единственный HTTP-фасад. Принимает запросы от фронта, валидирует
  через `nestjs-zod`, форвардит в нужный микросервис через RabbitMQ-RPC.
- Микросервисы общаются ТОЛЬКО через RabbitMQ — между собой напрямую не ходят.
- Refresh-token хранится в HttpOnly-cookie на домене фронта; access-token —
  в памяти фронта (auto-refresh за 30с до истечения).
- Парсер крипты использует Puppeteer + Chromium (alpine) внутри Docker.

## Структура

```
apps/
├── api-gateway/         ← HTTP вход
├── identity/            ← auth + users
├── assets/              ← общий каталог
├── portfolio-core/      ← портфели/транзакции
├── crypto-data-worker/  ← парсер CoinGecko
├── indexes-data-worker/ ← рыночные индексы
└── stock-data-worker/   ← биржевые индексы

libs/
├── contracts/           ← общие DTO/типы (импорт через @libs/contracts)
├── common/              ← общие константы (queue names, etc.)
└── crypto-data/         ← общие Sequelize-модели

db/
└── seed.sql.gz          ← начальный дамп (схема + крипто-каталог)
```

## Лицензия / контекст

Проект — выпускная работа МГТУ «СТАНКИН». Не для коммерческого использования.
