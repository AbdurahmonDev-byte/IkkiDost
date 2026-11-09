import { Body, Controller, Get, Param, Patch, Post, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { EmployeeDto } from '@ikki-dost/shared-types';
import { createEmployeeSchema, updateEmployeeSchema, type CreateEmployeeInput, type UpdateEmployeeInput } from '@ikki-dost/validation';
import { EmployeesService } from './employees.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
@Roles('OWNER')
export class EmployeesController {
  constructor(private employees: EmployeesService) {}

  @Get()
  findAll(): Promise<EmployeeDto[]> {
    return this.employees.findAll();
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createEmployeeSchema))
  create(@Body() input: CreateEmployeeInput, @CurrentUser() actor: RequestUser): Promise<EmployeeDto> {
    return this.employees.create(input, actor);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateEmployeeSchema))
  update(@Param('id') id: string, @Body() input: UpdateEmployeeInput, @CurrentUser() actor: RequestUser): Promise<EmployeeDto> {
    return this.employees.update(id, input, actor);
  }
}
