import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function start() {
  const PORT = process.env.PORT || 5000
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: 'http://localhost:5173', // разрешаем доступ только с фронта на этом порту
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type, Authorization'
  })

  await app.listen(PORT, () => console.log(`Запустилось на ${PORT} порту`))
}

start()