import{Controller,Get,Post,Patch,Param,Body,Req,UseGuards}from'@nestjs/common';
import{AuthRequest,SessionGuard,csrf}from'./auth';
import{Permission}from'./permissions';
import{SalesOrders}from'./sales-orders';
@Controller('api/sales')@UseGuards(SessionGuard)@Permission('sales.read')
export class SalesOrdersController{
 constructor(private sales:SalesOrders){}
 @Get('configuration')@Permission('sales.config.read')configuration(@Req() r:AuthRequest){return this.sales.configuration(r.user);}
 @Post('configuration/units')@Permission('sales.configure')unit(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.sales.createUnit(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('configuration/areas')@Permission('sales.configure')area(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.sales.createArea(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('configuration/terms')@Permission('sales.configure')term(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.sales.createTerm(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Patch('configuration/:kind/:id')@Permission('sales.configure')updateConfiguration(@Req() r:AuthRequest,@Param('kind') kind:string,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.sales.updateConfiguration(r.user,kind,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('context')@Permission('sales.write')context(@Req() r:AuthRequest){return this.sales.entryContext(r.user);}
 @Get('partners/:id')@Permission('sales.write')partner(@Req() r:AuthRequest,@Param('id') id:string){return this.sales.partnerChoices(r.user,id);}
 @Get('orders/:id')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.sales.detail(r.user,id);}
 @Post('orders/:id/partners')@Permission('sales.write')partnerRole(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.sales.assignPartner(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('orders/:id/items')@Permission('sales.write')item(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.sales.saveItem(r.user,id,null,b,r.get('Idempotency-Key'),r.correlationId);}
 @Patch('orders/:id/items/:itemId')@Permission('sales.write')updateItem(@Req() r:AuthRequest,@Param('id') id:string,@Param('itemId') itemId:string,@Body() b:unknown){csrf(r);return this.sales.saveItem(r.user,id,itemId,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('orders/:id/items/:itemId/schedules')@Permission('sales.write')schedules(@Req() r:AuthRequest,@Param('id') id:string,@Param('itemId') itemId:string,@Body() b:unknown){csrf(r);return this.sales.schedules(r.user,id,itemId,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('orders/:id/reprice')@Permission('sales.write')reprice(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.sales.reprice(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('orders/:id/withdraw')@Permission('sales.write')withdraw(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.sales.withdraw(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('orders/:id/cancel')@Permission('sales.write')cancel(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.sales.cancel(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('orders/:id/service-order')@Permission('sales.write')serviceOrder(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.sales.createServiceOrder(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('orders')list(@Req() r:AuthRequest){return this.sales.list(r.user);}
 @Post('orders')@Permission('sales.write')create(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.sales.create(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Patch('orders/:id')@Permission('sales.write')header(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.sales.updateHeader(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
