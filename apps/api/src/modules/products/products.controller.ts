import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { ProductDto } from '@ikki-dost/shared-types';
import { createProductSchema, updateProductSchema, type CreateProductInput, type UpdateProductInput } from '@ikki-dost/validation';
import { ProductsService } from './products.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  @Roles('OWNER', 'WAITER', 'CHEF', 'CASHIER')
  findAll(@Query('includeArchived') includeArchived?: string, @Query('categoryId') categoryId?: string): Promise<ProductDto[]> {
    return this.products.findAll({ includeArchived: includeArchived === 'true', categoryId });
  }

  @Post()
  @Roles('OWNER')
  @UsePipes(new ZodValidationPipe(createProductSchema))
  create(@Body() input: CreateProductInput, @CurrentUser() actor: RequestUser): Promise<ProductDto> {
    return this.products.create(input, actor);
  }

  @Patch(':id')
  @Roles('OWNER')
  @UsePipes(new ZodValidationPipe(updateProductSchema))
  update(@Param('id') id: string, @Body() input: UpdateProductInput, @CurrentUser() actor: RequestUser): Promise<ProductDto> {
    return this.products.update(id, input, actor);
  }

  @Post(':id/image')
  @Roles('OWNER')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadImage(@Param('id') id: string, @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined, @CurrentUser() actor: RequestUser): Promise<ProductDto> {
    if (!file) throw new BadRequestException('Rasm fayli yuklanmadi');
    return this.products.setImage(id, file.buffer, file.mimetype, actor);
  }

  @Delete(':id/image')
  @Roles('OWNER')
  removeImage(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<ProductDto> {
    return this.products.removeImage(id, actor);
  }
}
