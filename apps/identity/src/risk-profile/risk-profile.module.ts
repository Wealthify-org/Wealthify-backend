import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { RiskProfile } from "./risk-profile.model";
import { RiskProfileController } from "./risk-profile.controller";
import { RiskProfileService } from "./risk-profile.service";

@Module({
  imports: [SequelizeModule.forFeature([RiskProfile])],
  controllers: [RiskProfileController],
  providers: [RiskProfileService],
  exports: [RiskProfileService],
})
export class RiskProfileModule {}
