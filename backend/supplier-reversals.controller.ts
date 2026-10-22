import {Controller,Get,Post,Param,Body,Req,UseGuards} from '@nestjs/common';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {SupplierReversals} from './supplier-reversals';
@Controller('api/supplier-invoice-reversals')@UseGuards(SessionGuard)@Permission('ap.read')
export class SupplierReversalsController{
 constructor(private reversals:SupplierReversals){}
 @Get(':id')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.reversals.detail(r.user!,id);}
 @Post(':id/prepare')prepare(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown){csrf(r);return this.reversals.prepare(r.user!,id,body,r.headers['idempotency-key'],r.correlationId!);}
 @Post(':id/withdraw')withdraw(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown){csrf(r);return this.reversals.withdraw(r.user!,id,body,r.headers['idempotency-key'],r.correlationId!);}
 @Post(':id/post')post(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown){csrf(r);return this.reversals.post(r.user!,id,body,r.headers['idempotency-key'],r.correlationId!);}
}
