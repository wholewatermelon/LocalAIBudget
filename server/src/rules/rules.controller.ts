import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MATCH_TYPES } from './rule-matching';
import type { MatchType } from './rule-matching';
import { Rule, RulesService } from './rules.service';
import { Transaction } from '../transactions/transactions.service';

export class CreateRuleDto {
  @IsString() @IsNotEmpty() @MaxLength(200) pattern!: string;
  @IsOptional() @IsIn(MATCH_TYPES) matchType?: MatchType;
  @IsInt() categoryId!: number;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() applyToExisting?: boolean;
}

export class UpdateRuleDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) pattern?: string;
  @IsOptional() @IsIn(MATCH_TYPES) matchType?: MatchType;
  @IsOptional() @IsInt() categoryId?: number;
  @IsOptional() @IsInt() priority?: number;
}

export class PreviewRuleDto {
  @IsString() @IsNotEmpty() @MaxLength(200) pattern!: string;
  @IsOptional() @IsIn(MATCH_TYPES) matchType?: MatchType;
}

export class SuggestQueryDto {
  @Type(() => Number) @IsInt() transactionId!: number;
}

@Controller('rules')
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  list(): Promise<Rule[]> {
    return this.rules.list();
  }

  @Get('suggest')
  suggest(
    @Query() q: SuggestQueryDto,
  ): Promise<{ pattern: string; matchType: MatchType; matchCount: number }> {
    return this.rules.suggest(q.transactionId);
  }

  @Post('preview')
  @HttpCode(200)
  preview(
    @Body() dto: PreviewRuleDto,
  ): Promise<{ matchCount: number; sample: Transaction[] }> {
    return this.rules.preview(dto.pattern, dto.matchType);
  }

  @Post()
  create(
    @Body() dto: CreateRuleDto,
  ): Promise<Rule & { appliedCount?: number }> {
    return this.rules.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRuleDto,
  ): Promise<Rule> {
    return this.rules.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.rules.remove(id);
  }
}
