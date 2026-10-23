import {Controller,Get,Post,Param,Body,Req,Res,UseGuards} from '@nestjs/common';
import {Response} from 'express';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {CustomerCredits} from './customer-credits';
@Controller('api/customer-credits')@UseGuards(SessionGuard)@Permission('billing.credit.read')
export class CustomerCreditsController{
 constructor(private credits:CustomerCredits){}
 @Get()list(@Req() r:AuthRequest){return this.credits.list(r.user);}
 @Get(':id')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.credits.detail(r.user,id);}
 @Post('invoices/:id')@Permission('billing.credit.write')create(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.credits.create(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/prepare')@Permission('billing.credit.write')prepare(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.credits.prepare(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/withdraw')@Permission('billing.credit.write')withdraw(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.credits.withdraw(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/post')@Permission('billing.credit.write')post(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.credits.post(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/output')@Permission('billing.credit.write')output(@Req() r:AuthRequest,@Param('id') id:string){csrf(r);return this.credits.processOutput(r.user,id,r.correlationId);}
 @Get(':id/pdf')@Permission('billing.read')async pdf(@Req() r:AuthRequest,@Param('id') id:string,@Res() res:Response){const f=await this.credits.download(r.user,id,'pdf',r.correlationId);res.set({'Content-Type':'application/pdf','Content-Disposition':'inline; filename="'+f.filename+'"','Cache-Control':'private, no-store'}).send(f.data);}
 @Get(':id/xml')@Permission('billing.read')async xml(@Req() r:AuthRequest,@Param('id') id:string,@Res() res:Response){const f=await this.credits.download(r.user,id,'xml',r.correlationId);res.set({'Content-Type':'application/xml','Content-Disposition':'attachment; filename="'+f.filename+'"','Cache-Control':'private, no-store'}).send(f.data);}
}
