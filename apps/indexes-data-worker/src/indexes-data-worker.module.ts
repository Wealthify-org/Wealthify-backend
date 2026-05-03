import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SequelizeModule } from '@nestjs/sequelize';
import { IndexesDataWorkerController } from './indexes-data-worker.controller';
import { IndexesDataWorkerService } from './indexes-data-worker.service';
import { IndexSnapshot } from './index-snapshot.model';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.${process.env.NODE_ENV}.env`,
    }),
    ScheduleModule.forRoot(),
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      models: [IndexSnapshot],
      autoLoadModels: true,
      synchronize: true,
      sync: { alter: true },
    }),
    SequelizeModule.forFeature([IndexSnapshot]),
  ],
  controllers: [IndexesDataWorkerController],
  providers: [IndexesDataWorkerService],
})
export class IndexesDataWorkerModule {}
