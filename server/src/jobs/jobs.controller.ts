import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { MONTH_MESSAGE, MONTH_RE } from '../common/month';
import type { ProcessMode } from '../processing/processing.service';
import { Job, JobsService } from './jobs.service';

export class ProcessDto {
  @Matches(MONTH_RE, { message: MONTH_MESSAGE }) month!: string;
  @IsOptional() @IsIn(['incremental', 'recategorize']) mode?: ProcessMode;
}

export class JobsQueryDto {
  @IsOptional() @Matches(MONTH_RE, { message: MONTH_MESSAGE }) month?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('process')
  @HttpCode(202)
  process(@Body() dto: ProcessDto): Promise<Job> {
    return this.jobs.start(dto.month, dto.mode ?? 'incremental');
  }

  @Get()
  list(@Query() q: JobsQueryDto): Promise<Job[]> {
    return this.jobs.list(q.month, q.limit ?? 20);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number): Promise<Job> {
    return this.jobs.get(id);
  }
}
