import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Account, AccountsService } from './accounts.service';

export class UpdateAccountDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) accountName?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(50) accountType?: string;
}

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(): Promise<Account[]> {
    return this.accounts.list();
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccountDto,
  ): Promise<Account> {
    return this.accounts.update(id, dto);
  }
}
