import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as cookieParser from 'cookie-parser'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';

async function start() {
  const PORT = process.env.PORT || 5000
  const app = await NestFactory.create(AppModule)

  const config = new DocumentBuilder()
    .setTitle('Персональный менеджер инвестиций')
    .setDescription('Документация REST API')
    .setVersion('0.0.1')
    .addTag('outea7t')
    .build()

  app.use(cookieParser())

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api/docs', app, cleanupOpenApiDoc(document));

  app.enableCors({
    origin: 'http://localhost:3000', // разрешаем доступ только с фронта на этом порту
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true
  })

  app.useGlobalPipes(new ZodValidationPipe());
  

  await app.listen(PORT, () => console.log(`Запустилось на ${PORT} порту`))
}

start()