import{Controller,Get,Post,Req,Param,Body,UseGuards}from'@nestjs/common';import{AuthRequest,SessionGuard,csrf}from'./auth';import{Permission}from'./permissions';import{CustomerReturns}from'./customer-returns';
@Controller('api/customer-returns')@UseGuards(SessionGuard)@Permission('sales.return.read')export class CustomerReturnsController{
 constructor(private returns:CustomerReturns){}
 @Get()list(@Req()r:AuthRequest){return this.returns.list(r.user);}
 @Get('deliveries/:id/selection')@Permission('sales.return.write')selection(@Req()r:AuthRequest,@Param('id')id:string){return this.returns.selection(r.user,id);}
 @Post('deliveries/:id')@Permission('sales.return.write')create(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.returns.create(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('receipts/:id')receipt(@Req()r:AuthRequest,@Param('id')id:string){return this.returns.receipt(r.user,id);}
 @Post('receipts/:id/reverse')@Permission('sales.return.receive')reverse(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.returns.reverse(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get(':id')detail(@Req()r:AuthRequest,@Param('id')id:string){return this.returns.detail(r.user,id);}
 @Post(':id/release')@Permission('sales.return.write')release(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.returns.transition(r.user,id,'release',b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/cancel')@Permission('sales.return.write')cancel(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.returns.transition(r.user,id,'cancel',b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/receipts')@Permission('sales.return.receive')receive(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.returns.receive(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
