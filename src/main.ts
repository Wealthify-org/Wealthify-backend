import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { ValidationPipe } from '@nestjs/common'

async function start() {
  const PORT = process.env.PORT || 5000
  const app = await NestFactory.create(AppModule)

  const config = new DocumentBuilder()
    .setTitle('Персональный менеджер инвестиций')
    .setDescription('Документация REST API')
    .setVersion('0.0.1')
    .addTag('outea7t')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('/api/docs', app, document)

  app.enableCors({
    origin: 'http://localhost:5173', // разрешаем доступ только с фронта на этом порту
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type, Authorization'
  })

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  }))

  await app.listen(PORT, () => console.log(`Запустилось на ${PORT} порту`))
}

start()