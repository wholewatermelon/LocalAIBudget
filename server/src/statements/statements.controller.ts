import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IsOptional, Matches } from 'class-validator';
import { MONTH_MESSAGE, MONTH_RE } from '../common/month';
import {
  MonthSummary,
  StatementFile,
  StatementsService,
} from './statements.service';

export class MonthQueryDto {
  @Matches(MONTH_RE, { message: MONTH_MESSAGE }) month!: string;
}

export class UploadBodyDto {
  @IsOptional() @Matches(MONTH_RE, { message: MONTH_MESSAGE }) month?: string;
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

@Controller()
export class StatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Get('months')
  months(): Promise<MonthSummary[]> {
    return this.statements.months();
  }

  @Get('statements')
  list(@Query() q: MonthQueryDto): Promise<StatementFile[]> {
    return this.statements.list(q.month);
  }

  @Post('statements/upload')
  @UseInterceptors(
    FilesInterceptor('files', 50, { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UploadBodyDto,
  ): Promise<StatementFile[]> {
    return this.statements.upload(files ?? [], body.month);
  }

  @Delete('statements/:id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.statements.remove(id);
  }
}
