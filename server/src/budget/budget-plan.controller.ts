import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  PipeTransform,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { isMonth, MONTH_MESSAGE, MONTH_RE } from '../common/month';
import { ROUND_TO_VALUES } from './budget-plan';
import type { RoundTo } from './budget-plan';
import {
  BudgetPlanService,
  MainBudget,
  MainHistoryEntry,
  MonthBudget,
  SeedPreview,
} from './budget-plan.service';

class ParseMonthPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isMonth(value)) throw new BadRequestException(MONTH_MESSAGE);
    return value;
  }
}

export class MonthQueryDto {
  @Matches(MONTH_RE, { message: MONTH_MESSAGE }) month!: string;
}

export class HistoryQueryDto {
  @Type(() => Number) @IsInt() categoryId!: number;
}

export class PutMainItemDto {
  /** number = budget amount; null = remove from the main budget from effectiveFrom on. */
  @ValidateIf((o: PutMainItemDto) => o.amount !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number | null;

  @Matches(MONTH_RE, { message: 'effectiveFrom must be YYYY-MM' })
  effectiveFrom!: string;
}

export class SeedDto {
  @Matches(MONTH_RE, { message: 'fromMonth must be YYYY-MM' })
  fromMonth!: string;
  @IsIn(['actual', 'budget', 'average']) source!:
    'actual' | 'budget' | 'average';
  @IsOptional() @IsInt() @Min(1) @Max(24) averageMonths?: number;
  @IsOptional() @IsIn(ROUND_TO_VALUES) roundTo?: RoundTo;
  @Matches(MONTH_RE, { message: 'effectiveFrom must be YYYY-MM' })
  effectiveFrom!: string;
}

export class PutMonthItemDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount?: number;
  @IsOptional() @IsBoolean() hidden?: boolean;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class CopyAdjustmentsDto {
  @Matches(MONTH_RE, { message: 'fromMonth must be YYYY-MM' })
  fromMonth!: string;
}

@Controller('budget')
export class BudgetPlanController {
  constructor(private readonly plan: BudgetPlanService) {}

  @Get('main')
  main(@Query() q: MonthQueryDto): Promise<MainBudget> {
    return this.plan.main(q.month);
  }

  @Get('main/history')
  history(@Query() q: HistoryQueryDto): Promise<MainHistoryEntry[]> {
    return this.plan.history(q.categoryId);
  }

  @Put('main/items/:categoryId')
  putMain(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: PutMainItemDto,
  ): Promise<MainBudget> {
    if (dto.amount === undefined)
      throw new BadRequestException('amount (number or null) is required');
    return this.plan.putMainItem(categoryId, dto.amount, dto.effectiveFrom);
  }

  @Delete('main/items/:categoryId/versions/:effectiveFrom')
  @HttpCode(204)
  deleteVersion(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Param('effectiveFrom', ParseMonthPipe) effectiveFrom: string,
  ): Promise<void> {
    return this.plan.deleteMainVersion(categoryId, effectiveFrom);
  }

  @Post('main/seed/preview')
  @HttpCode(200)
  seedPreview(@Body() dto: SeedDto): Promise<SeedPreview> {
    return this.plan.seedPreview(dto);
  }

  @Post('main/seed')
  @HttpCode(200)
  seed(@Body() dto: SeedDto): Promise<MainBudget> {
    return this.plan.seed(dto);
  }

  @Get('month')
  month(@Query() q: MonthQueryDto): Promise<MonthBudget> {
    return this.plan.month(q.month);
  }

  @Put('month/:month/items/:categoryId')
  putMonthItem(
    @Param('month', ParseMonthPipe) month: string,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: PutMonthItemDto,
  ): Promise<MonthBudget> {
    return this.plan.putMonthItem(month, categoryId, dto);
  }

  @Delete('month/:month/items/:categoryId')
  resetMonthItem(
    @Param('month', ParseMonthPipe) month: string,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ): Promise<MonthBudget> {
    return this.plan.resetMonthItem(month, categoryId);
  }

  @Post('month/:month/copy-adjustments')
  @HttpCode(200)
  copyAdjustments(
    @Param('month', ParseMonthPipe) month: string,
    @Body() dto: CopyAdjustmentsDto,
  ): Promise<MonthBudget> {
    return this.plan.copyAdjustments(month, dto.fromMonth);
  }
}
