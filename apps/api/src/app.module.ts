import { Module } from '@nestjs/common'
import { AuthModule } from './modules/auth/auth.module'
import { AdminModule } from './modules/admin/admin.module'

@Module({
  imports: [AuthModule, AdminModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
