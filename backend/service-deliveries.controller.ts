import {Controller,Get,Post,Param,Body,Req,UseGuards} from '@nestjs/common';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {ServiceDeliveries} from './service-deliveries';
@Controller('api')@UseGuards(SessionGuard)
export class ServiceDeliveriesController{
 constructor(private deliveries:ServiceDeliveries){}
 @Get('service/orders/:id/delivery-context')@Permission('inventory.issue')context(@Req() r:AuthRequest,@Param('id') id:string){return this.deliveries.context(r.user,id);}
 @Get('service/orders/:id/deliveries')@Permission('requisition.read')list(@Req() r:AuthRequest,@Param('id') id:string){return this.deliveries.list(r.user,id);}
 @Post('service/orders/:id/deliveries')@Permission('inventory.issue')deliver(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.deliveries.deliver(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('inventory/issues/:id')@Permission('document.read')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.deliveries.detail(r.user,id);}
 @Post('inventory/issues/:id/reverse')@Permission('inventory.issue')reverse(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.deliveries.reverse(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
