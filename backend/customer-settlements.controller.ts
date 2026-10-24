import {Controller,Get,Post,Param,Body,Req,Query,UseGuards} from '@nestjs/common';
import {AuthRequest,SessionGuard,csrf} from './auth';import {Permission} from './permissions';import {CustomerSettlements} from './customer-settlements';
@Controller('api/customer-settlements') @UseGuards(SessionGuard) @Permission('settlement.read')
export class CustomerSettlementsController{
 constructor(private service:CustomerSettlements){}
 @Get()list(@Req()r:AuthRequest,@Query('invoiceId')id?:string){return this.service.list(r.user,id);}
 @Get('invoices/:id/context')@Permission('settlement.write')context(@Req()r:AuthRequest,@Param('id')id:string){return this.service.context(r.user,id);}
 @Post('invoices/:id')@Permission('settlement.write')create(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.create(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get(':id')detail(@Req()r:AuthRequest,@Param('id')id:string){return this.service.detail(r.user,id);}
 @Post(':id/reverse')@Permission('settlement.write')reverse(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.reverse(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/review')@Permission('settlement.review')review(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.action(r.user,id,'review',b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/post')@Permission('settlement.write')post(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.action(r.user,id,'post',b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/cancel')@Permission('settlement.write')cancel(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.action(r.user,id,'cancel',b,r.get('Idempotency-Key'),r.correlationId);}
}
