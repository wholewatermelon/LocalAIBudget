import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { MONTH_MESSAGE, MONTH_RE } from '../common/month';
import { BudgetSummary } from './budget-math';
import { BudgetService, TrendPoint } from './budget.service';

export class SummaryQueryDto {
  @Matches(MONTH_RE, { message: MONTH_MESSAGE }) month!: string;
}

export class TrendQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) months?: number;
  /** Optional anchor (last month of the window). Default: latest month with transactions. */
  @IsOptional() @Matches(MONTH_RE, { message: MONTH_MESSAGE }) month?: string;
}

@Controller('budget')
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  @Get('summary')
  summary(@Query() q: SummaryQueryDto): Promise<BudgetSummary> {
    return this.budget.summary(q.month);
  }

  @Get('trend')
  trend(@Query() q: TrendQueryDto): Promise<TrendPoint[]> {
    return this.budget.trend(q.months ?? 6, q.month);
  }
}
