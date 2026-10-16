import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MONTH_MESSAGE, MONTH_RE } from '../common/month';
import { Transaction, TransactionsService } from './transactions.service';

const toBool = ({ value }: { value: unknown }) =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : value;

export class TransactionQueryDto {
  @IsOptional() @Matches(MONTH_RE, { message: MONTH_MESSAGE }) month?: string;
  @IsOptional() @Type(() => Number) @IsInt() accountId?: number;
  @IsOptional() @Type(() => Number) @IsInt() categoryId?: number;
  @IsOptional() @Transform(toBool) @IsBoolean() uncategorized?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() needsReview?: boolean;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}

export class PatchTransactionDto {
  /** number = set category, null = clear category (both are manual corrections). */
  @ValidateIf(
    (o: PatchTransactionDto) =>
      o.categoryId !== null && o.categoryId !== undefined,
  )
  @IsInt()
  categoryId?: number | null;

  @IsOptional() @IsBoolean() reviewed?: boolean;
}

export class SplitDto {
  @IsInt() categoryId!: number;
  @IsNumber({ allowNaN: false, allowInfinity: false }) amount!: number;
}

export class PutSplitsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SplitDto)
  splits!: SplitDto[];
}

export class ReviewDto {
  @IsArray() @ArrayMaxSize(5000) @IsInt({ each: true }) ids!: number[];
}

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@Query() q: TransactionQueryDto): Promise<Transaction[]> {
    return this.transactions.list(q);
  }

  @Post('review')
  @HttpCode(200)
  review(@Body() dto: ReviewDto): Promise<{ updated: number }> {
    return this.transactions.markReviewed(dto.ids);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchTransactionDto,
  ): Promise<Transaction> {
    return this.transactions.update(id, dto);
  }

  @Put(':id/splits')
  setSplits(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PutSplitsDto,
  ): Promise<Transaction> {
    return this.transactions.setSplits(id, dto.splits);
  }
}
