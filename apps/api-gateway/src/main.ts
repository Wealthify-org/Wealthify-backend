import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import * as cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';

async function bootstrap() {
  const PORT = Number(process.env.PORT ?? 5000)
  const origin = process.env.WEB_ORIGIN
  const app = await NestFactory.create(ApiGatewayModule);

  const config = new DocumentBuilder()
    .setTitle('Персональный менеджер инвестиций')
    .setDescription('Документация REST API')
    .setVersion('0.0.1')
    .addTag('outea7t')
    .build()

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api/docs', app, cleanupOpenApiDoc(document));

  app.use(cookieParser())

    app.enableCors({
      origin,
      credentials: true,
      methods: 'GET,POST,PUT, PATCH, DELETE, OPTIONS ',
      allowedHeaders: ['Content-Type', 'Authorization'],
  })

  app.useGlobalPipes(new ZodValidationPipe());

  await app.listen(PORT, () => console.log(`Запустилось на ${PORT} порту`));
}

bootstrap();
