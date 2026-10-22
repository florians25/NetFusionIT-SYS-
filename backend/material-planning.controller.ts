import {Controller,Get,Post,Param,Body,Req,UseGuards} from '@nestjs/common';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {MaterialPlanning} from './material-planning';
@Controller('api/service/orders')@UseGuards(SessionGuard)
export class MaterialPlanningController{
 constructor(private planning:MaterialPlanning){}
 @Get(':id/material-planning')@Permission('requisition.read')overview(@Req() r:AuthRequest,@Param('id') id:string){return this.planning.overview(r.user,id);}
 @Post(':id/material-planning')@Permission('inventory.reserve')plan(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.planning.plan(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/reservations/:reservation/release')@Permission('inventory.reserve')release(@Req() r:AuthRequest,@Param('id') id:string,@Param('reservation') reservation:string,@Body() b:unknown){csrf(r);return this.planning.release(r.user,id,reservation,b,r.get('Idempotency-Key'),r.correlationId);}
}
