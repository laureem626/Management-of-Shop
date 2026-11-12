import { Module } from '@nestjs/common';
import { TenantMigrationService } from './service/tenants-service';

@Module({
  providers: [TenantMigrationService],
  exports: [TenantMigrationService],
})
export class TenantsModule {}