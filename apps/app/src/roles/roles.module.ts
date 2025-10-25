import { forwardRef, Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Role } from './roles.model';
import { User } from '@app/users/users.model';
import { UserRoles } from './user-roles.model';
import { AuthModule } from '@app/auth/auth.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Role, User, UserRoles]),
    forwardRef(() => AuthModule)
  ],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [
    RolesService
  ]
})
export class RolesModule {}
