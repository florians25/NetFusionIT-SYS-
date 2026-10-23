import {Controller,Get,Post,Param,Body,Req,UseGuards} from '@nestjs/common';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {SalesFulfillment} from './sales-fulfillment';
@Controller('api/sales')@UseGuards(SessionGuard)@Permission('sales.fulfillment.read')
export class SalesFulfillmentController{
 constructor(private fulfillment:SalesFulfillment){}
 @Get('deliveries/:id')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.fulfillment.detail(r.user,id);}
 @Get('fulfillment')list(@Req() r:AuthRequest){return this.fulfillment.list(r.user);}
 @Get('orders/:id/fulfillment')context(@Req() r:AuthRequest,@Param('id') id:string){return this.fulfillment.context(r.user,id);}
 @Post('orders/:id/reservations')@Permission('sales.reserve')reserve(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.fulfillment.reserve(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('orders/:id/reservations/:reservationId/release')@Permission('sales.reserve')release(@Req() r:AuthRequest,@Param('id') id:string,@Param('reservationId') reservationId:string,@Body() b:unknown){csrf(r);return this.fulfillment.release(r.user,id,reservationId,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('orders/:id/deliveries')@Permission('sales.deliver')deliver(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.fulfillment.deliver(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
