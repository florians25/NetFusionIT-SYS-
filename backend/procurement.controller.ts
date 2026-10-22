import { Controller,Get,Post,Param,Body,Req,UseGuards } from '@nestjs/common';
import { AuthRequest,SessionGuard,csrf } from './auth';
import { Permission } from './permissions';
import { Procurement } from './procurement';
@Controller('api')@UseGuards(SessionGuard)
export class ProcurementController {
 constructor(private procurement:Procurement){}
 @Get('procurement/suppliers')@Permission('supplier.read')suppliers(@Req() r:AuthRequest){return this.procurement.suppliers(r.user);}
 @Post('procurement/suppliers')@Permission('partner.write')supplier(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.procurement.supplier(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('service/orders/:id/procurement')@Permission('requisition.read')overview(@Req() r:AuthRequest,@Param('id') id:string){return this.procurement.overview(r.user,id);}
 @Post('service/orders/:id/material-requirements')@Permission('requisition.write')requirement(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.procurement.requirement(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('service/orders/:id/requisitions')@Permission('requisition.write')requisition(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.procurement.createRequisition(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('service/orders/:id/purchase-orders')@Permission('procurement.write')purchaseOrder(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.procurement.createPurchaseOrder(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('procurement/documents/:id/cancel')@Permission('requisition.read')cancel(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.procurement.cancel(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('procurement/documents/:id')@Permission('requisition.read')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.procurement.detail(r.user,id);}
}
