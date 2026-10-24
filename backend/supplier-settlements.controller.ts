import {Controller,Get,Post,Param,Body,Req,Query,UseGuards,BadRequestException} from '@nestjs/common';
import {AuthRequest,SessionGuard,csrf} from './auth';import {Permission} from './permissions';import {SupplierSettlements} from './supplier-settlements';
@Controller('api/supplier-settlements') @UseGuards(SessionGuard) @Permission('ap.payment.read')
export class SupplierSettlementsController{
 constructor(private service:SupplierSettlements){}
 @Get()list(@Req()r:AuthRequest,@Query('invoiceId')id?:string){return this.service.list(r.user,id);}
 @Get('invoices/:id/context')context(@Req()r:AuthRequest,@Param('id')id:string){return this.service.context(r.user,id);}
 @Post('invoices/:id')@Permission('ap.payment.write')create(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.create(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('invoices/:id/control/:action')control(@Req()r:AuthRequest,@Param('id')id:string,@Param('action')action:string,@Body()b:unknown){csrf(r);if(!['request','approve','block'].includes(action))throw new BadRequestException('Unzulässige Zahlungsfreigabeaktion.');return this.service.control(r.user,id,action as 'request'|'approve'|'block',b,r.get('Idempotency-Key'),r.correlationId);}
 @Get(':id')detail(@Req()r:AuthRequest,@Param('id')id:string){return this.service.detail(r.user,id);}
 @Post(':id/reverse')@Permission('ap.payment.write')reverse(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.reverse(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/review')@Permission('ap.payment.review')review(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.action(r.user,id,'review',b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/post')@Permission('ap.payment.write')post(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.action(r.user,id,'post',b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/cancel')@Permission('ap.payment.write')cancel(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.action(r.user,id,'cancel',b,r.get('Idempotency-Key'),r.correlationId);}
}
