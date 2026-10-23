import{Controller,Get,Post,Param,Body,Req,UseGuards}from'@nestjs/common';import{AuthRequest,SessionGuard,csrf}from'./auth';import{Permission}from'./permissions';import{DirectProcurement}from'./direct-procurement';import{Procurement}from'./procurement';
@Controller('api/sales')@UseGuards(SessionGuard)@Permission('sales.procurement.read')
export class DirectProcurementController{
 constructor(private direct:DirectProcurement,private procurement:Procurement){}
 @Get('procurement')list(@Req()r:AuthRequest){return this.direct.list(r.user);}
 @Get('orders/:id/procurement')context(@Req()r:AuthRequest,@Param('id')id:string){return this.direct.context(r.user,id,r.correlationId);}
 @Post('orders/:id/material-plan')@Permission('sales.procurement.plan')plan(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.direct.plan(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('orders/:id/purchase-orders')@Permission('procurement.write')purchase(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.procurement.createPurchaseOrder(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
