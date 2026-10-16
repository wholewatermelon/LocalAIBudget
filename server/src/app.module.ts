import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module';
import { BudgetModule } from './budget/budget.module';
import { CategoriesModule } from './categories/categories.module';
import { AppConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { InsightsModule } from './insights/insights.module';
import { JobsModule } from './jobs/jobs.module';
import { LlmModule } from './llm/llm.module';
import { ParsingModule } from './parsing/parsing.module';
import { RulesModule } from './rules/rules.module';
import { StatementsModule } from './statements/statements.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    AppConfigModule,
    DbModule,
    LlmModule,
    ParsingModule,
    AccountsModule,
    CategoriesModule,
    StatementsModule,
    TransactionsModule,
    RulesModule,
    JobsModule,
    BudgetModule,
    InsightsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
