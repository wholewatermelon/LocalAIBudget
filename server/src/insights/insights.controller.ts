import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Matches } from 'class-validator';
import { MONTH_MESSAGE, MONTH_RE } from '../common/month';
import { Insight, InsightsService } from './insights.service';

export class InsightMonthDto {
  @Matches(MONTH_RE, { message: MONTH_MESSAGE }) month!: string;
}

@Controller('insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  /** Sends a literal JSON `null` when there is no insight (Nest would otherwise send an empty body). */
  @Get()
  async latest(
    @Query() q: InsightMonthDto,
    @Res() res: Response,
  ): Promise<void> {
    res.status(200).json(await this.insights.latest(q.month));
  }

  @Post('generate')
  @HttpCode(201)
  generate(@Body() dto: InsightMonthDto): Promise<Insight> {
    return this.insights.generate(dto.month);
  }
}
