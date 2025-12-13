import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { IndexesDataWorkerController } from './indexes-data-worker.controller';
import { IndexesDataWorkerService } from './indexes-data-worker.service';
// добавление моделей
// import { IndexModel } from '@libs/indexes-data/models';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.${process.env.NODE_ENV}.env`,
    }),
    // добавление БД
    // SequelizeModule.forRoot({
    //   dialect: 'postgres',
    //   host: process.env.POSTGRES_HOST,
    //   port: Number(process.env.POSTGRES_PORT),
    //   username: process.env.POSTGRES_USER,
    //   password: process.env.POSTGRES_PASSWORD,
    //   database: process.env.POSTGRES_DB,
    //   models: [IndexModel],
    //   autoLoadModels: true,
    //   synchronize: true,
    //   sync: { alter: true },
    // }),
  ],
  controllers: [IndexesDataWorkerController],
  providers: [IndexesDataWorkerService],
})
export class IndexesDataWorkerModule {}
