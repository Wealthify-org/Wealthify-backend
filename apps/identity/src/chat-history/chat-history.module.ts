import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { ChatMessage } from "./chat-message.model";
import { ChatHistoryController } from "./chat-history.controller";
import { ChatHistoryService } from "./chat-history.service";

@Module({
  imports: [SequelizeModule.forFeature([ChatMessage])],
  controllers: [ChatHistoryController],
  providers: [ChatHistoryService],
  exports: [ChatHistoryService],
})
export class ChatHistoryModule {}
