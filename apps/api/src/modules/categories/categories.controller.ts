import { Body, Controller, Get, Param, Patch, Post, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CategoryDto } from '@ikki-dost/shared-types';
import { createCategorySchema, updateCategorySchema, type CreateCategoryInput, type UpdateCategoryInput } from '@ikki-dost/validation';
import { CategoriesService } from './categories.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  @Roles('OWNER', 'WAITER', 'CHEF', 'CASHIER')
  findAll(): Promise<CategoryDto[]> {
    return this.categories.findAll();
  }

  @Post()
  @Roles('OWNER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(createCategorySchema))
  create(@Body() input: CreateCategoryInput): Promise<CategoryDto> {
    return this.categories.create(input);
  }

  @Patch(':id')
  @Roles('OWNER', 'CASHIER')
  @UsePipes(new ZodValidationPipe(updateCategorySchema))
  update(@Param('id') id: string, @Body() input: UpdateCategoryInput): Promise<CategoryDto> {
    return this.categories.update(id, input);
  }
}
