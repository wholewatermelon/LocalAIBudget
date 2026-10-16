import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget/budget.module';
import { CategoriesModule } from '../categories/categories.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

@Module({
  imports: [BudgetModule, CategoriesModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
