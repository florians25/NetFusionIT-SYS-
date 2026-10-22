import { Controller,Get,Post,Patch,Body,Param,Req,UseGuards } from '@nestjs/common';
import { AuthRequest,SessionGuard,csrf } from './auth';
import { Permission } from './permissions';
import { Commerce } from './commerce';
@Controller('api')@UseGuards(SessionGuard)
export class CommerceController {
 constructor(private commerce:Commerce){}
 @Get('catalog/currencies')currencies(@Req() r:AuthRequest){return this.commerce.currencies(r.user);}
 @Post('catalog/currencies')@Permission('admin.write')currency(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.commerce.currency(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('catalog/products')@Permission('inventory.read')products(@Req() r:AuthRequest){return this.commerce.products(r.user);}
 @Post('catalog/products')@Permission('material.write')product(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.commerce.createProduct(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Patch('catalog/products/:id')@Permission('material.write')update(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.commerce.updateProduct(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('pricing/conditions')@Permission('pricing.write')conditions(@Req() r:AuthRequest){return this.commerce.conditions(r.user);}
 @Post('pricing/conditions')@Permission('pricing.write')condition(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.commerce.createCondition(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('pricing/conditions/:id/disable')@Permission('pricing.write')disable(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.commerce.disableCondition(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('service/orders')@Permission('order.read')orders(@Req() r:AuthRequest){return this.commerce.orders(r.user);}
 @Get('service/order-contexts')@Permission('order.write')contexts(@Req() r:AuthRequest){return this.commerce.contexts(r.user);}
 @Post('service/orders')@Permission('order.write')order(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.commerce.create(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('service/orders/:id')@Permission('order.read')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.commerce.detail(r.user,id);}
 @Post('service/orders/:id/items')@Permission('order.write')item(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.commerce.addItem(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
