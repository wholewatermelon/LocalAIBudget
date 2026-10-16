import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { BudgetPlanController } from './budget-plan.controller';
import { BudgetPlanService } from './budget-plan.service';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';

@Module({
  imports: [CategoriesModule],
  controllers: [BudgetController, BudgetPlanController],
  providers: [BudgetService, BudgetPlanService],
  exports: [BudgetService, BudgetPlanService],
})
export class BudgetModule {}
