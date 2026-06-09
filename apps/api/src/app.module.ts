import { Module } from '@nestjs/common'
import { AuthModule } from './modules/auth/auth.module'
import { AdminModule } from './modules/admin/admin.module'
import { VendorModule } from './modules/vendor/vendor.module'

@Module({
  imports: [AuthModule, AdminModule, VendorModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
