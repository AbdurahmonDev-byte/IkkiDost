import { Body, Controller, Delete, Get, Param, Post, Query, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ExpenseDto } from '@ikki-dost/shared-types';
import { createExpenseSchema, type CreateExpenseInput } from '@ikki-dost/validation';
import { ExpensesService } from './expenses.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Get()
  @Roles('OWNER', 'CASHIER')
  findAll(@Query('from') from?: string, @Query('to') to?: string): Promise<ExpenseDto[]> {
    return this.expenses.findAll({ from, to });
  }

  @Post()
  @Roles('OWNER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(createExpenseSchema))
  create(@Body() input: CreateExpenseInput, @CurrentUser() actor: RequestUser): Promise<ExpenseDto> {
    return this.expenses.create(input, actor);
  }

  @Delete(':id')
  @Roles('OWNER')
  delete(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<void> {
    return this.expenses.delete(id, actor);
  }
}
