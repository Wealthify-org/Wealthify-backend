import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from './users.model';
import { AuthModule } from '@app/auth/auth.module';
import { Role } from '@app/roles/roles.model';
import { UserRoles } from '@app/roles/user-roles.model';
import { RolesModule } from '@app/roles/roles.module';
import { Portfolio } from '@app/portfolios/portfolios.model';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [
    SequelizeModule.forFeature([User, Role, UserRoles, Portfolio]),
    RolesModule,
    forwardRef(() => AuthModule)
  ],
  exports: [
    UsersService,
  ]

})
export class UsersModule {}
