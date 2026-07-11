import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AllergyCheckerService } from './services/allergy-checker.service';

@Module({
  imports: [ConfigModule],
  providers: [AllergyCheckerService],
  exports: [AllergyCheckerService],
})
export class ClinicalCareFeaturePrescriptionModule {}