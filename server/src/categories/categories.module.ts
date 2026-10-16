import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoryAccessService } from './category-access.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoryAccessService],
  exports: [CategoriesService, CategoryAccessService],
})
export class CategoriesModule {}
