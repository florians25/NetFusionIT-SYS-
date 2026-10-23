import{Controller,Get,Post,Patch,Param,Body,Req,Query,UseGuards}from'@nestjs/common';
import{AuthRequest,SessionGuard,csrf}from'./auth';
import{Permission}from'./permissions';
import{ServiceQuotes}from'./service-quotes';
@Controller('api/quotes')@UseGuards(SessionGuard)@Permission('quote.read')
export class ServiceQuotesController{
 constructor(private quotes:ServiceQuotes){}
 @Get()list(@Req() r:AuthRequest,@Query('purpose') purpose?:string){return this.quotes.list(r.user,purpose);}
 @Get(':id')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.quotes.detail(r.user,id);}
 @Post()@Permission('quote.write')create(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.quotes.create(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Patch(':id')@Permission('quote.write')header(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.quotes.updateHeader(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/partners')@Permission('quote.write')partner(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.quotes.assignPartner(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/items')@Permission('quote.write')item(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.quotes.saveItem(r.user,id,null,b,r.get('Idempotency-Key'),r.correlationId);}
 @Patch(':id/items/:itemId')@Permission('quote.write')updateItem(@Req() r:AuthRequest,@Param('id') id:string,@Param('itemId') itemId:string,@Body() b:unknown){csrf(r);return this.quotes.saveItem(r.user,id,itemId,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/items/:itemId/schedules')@Permission('quote.write')schedules(@Req() r:AuthRequest,@Param('id') id:string,@Param('itemId') itemId:string,@Body() b:unknown){csrf(r);return this.quotes.schedules(r.user,id,itemId,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/reprice')@Permission('quote.write')reprice(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.quotes.reprice(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/withdraw')@Permission('quote.write')withdraw(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.quotes.withdraw(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/publish')@Permission('quote.write')publish(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.quotes.publish(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/decide')@Permission('quote.decide')decide(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.quotes.decide(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/order')@Permission('quote.write')convert(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.quotes.convert(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/cancel')@Permission('quote.write')cancel(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.quotes.cancel(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
