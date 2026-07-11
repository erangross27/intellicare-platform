import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsApiGatewayService } from './services/analytics-api-gateway.service';
import { AnalyticsSecurityService } from './services/analytics-security.service';

@Module({
  imports: [ConfigModule],
  providers: [
    AnalyticsApiGatewayService,
    AnalyticsSecurityService
  ],
  exports: [
    AnalyticsApiGatewayService,
    AnalyticsSecurityService
  ],
})
export class AiAnalyticsFeatureAnalyticsModule {}