import { Module } from '@nestjs/common';
import { StatementParserService } from './statement-parser.service';

@Module({
  providers: [StatementParserService],
  exports: [StatementParserService],
})
export class ParsingModule {}
