import { Module } from '@nestjs/common';
import { ParsingModule } from '../parsing/parsing.module';
import { CategorizerService } from '../processing/categorizer.service';
import { ProcessingService } from '../processing/processing.service';
import { RulesModule } from '../rules/rules.module';
import { StatementsModule } from '../statements/statements.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [ParsingModule, StatementsModule, RulesModule],
  controllers: [JobsController],
  providers: [JobsService, ProcessingService, CategorizerService],
  exports: [JobsService],
})
export class JobsModule {}
