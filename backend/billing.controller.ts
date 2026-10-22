import {Controller,Get,Post,Patch,Param,Body,Req,Res,UseGuards} from '@nestjs/common';
import {Response} from 'express';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {Billing} from './billing';
import {PartnerFinance} from './partner-finance';
@Controller('api/billing')@UseGuards(SessionGuard)@Permission('billing.read.internal')
export class BillingController{
 constructor(private billing:Billing,private partners:PartnerFinance){}
 @Get('worklist')worklist(@Req() r:AuthRequest){return this.billing.worklist(r.user);}
 @Get('orders/:id/sources')@Permission('billing.release')sources(@Req() r:AuthRequest,@Param('id') id:string){return this.billing.sources(r.user,id);}
 @Post('orders/:id/requests')@Permission('billing.release')create(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.billing.createRequest(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('requests/:id')request(@Req() r:AuthRequest,@Param('id') id:string){return this.billing.request(r.user,id);}
 @Post('requests/:id/cancel')@Permission('billing.release')cancel(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.billing.cancelRequest(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('companies/:id/context')context(@Req() r:AuthRequest,@Param('id') id:string){return this.billing.context(r.user,id);}
 @Post('invoices')@Permission('billing.write')post(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.billing.postInvoice(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('invoices/:id')@Permission('billing.read')invoice(@Req() r:AuthRequest,@Param('id') id:string){return this.billing.invoice(r.user,id);}
 @Post('invoices/:id/output')@Permission('billing.write')output(@Req() r:AuthRequest,@Param('id') id:string){csrf(r);return this.billing.processOutput(r.user,id,r.correlationId);}
 @Get('invoices/:id/pdf')@Permission('billing.read')pdf(@Req() r:AuthRequest,@Param('id') id:string,@Res() res:Response){return this.send(r,id,'pdf',res);}
 @Get('invoices/:id/xml')@Permission('billing.read')xml(@Req() r:AuthRequest,@Param('id') id:string,@Res() res:Response){return this.send(r,id,'xml',res);}
 private async send(r:AuthRequest,id:string,kind:'pdf'|'xml',res:Response){const file=await this.billing.download(r.user,id,kind,r.correlationId);res.set({'Content-Type':kind==='pdf'?'application/pdf':'application/xml; charset=utf-8','Content-Disposition':'attachment; filename="'+file.filename+'"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}).send(file.data);}
 @Get('profiles')profiles(@Req() r:AuthRequest){return this.partners.profiles(r.user);}
 @Post('profiles')@Permission('partner.account.write')profile(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.partners.createProfile(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
}
@Controller('api/partners')@UseGuards(SessionGuard)@Permission('partner.read')
export class PartnerFinanceController{
 constructor(private partners:PartnerFinance){}
 @Get(':id/accounts')@Permission('partner.account.read')accounts(@Req() r:AuthRequest,@Param('id') id:string){return this.partners.context(r.user,id);}
 @Post(':id/accounts')@Permission('partner.account.write')account(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.partners.createAccount(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/contacts')@Permission('partner.write')contact(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.partners.saveContact(r.user,id,null,b,r.get('Idempotency-Key'),r.correlationId);}
 @Patch(':id/contacts/:contact')@Permission('partner.write')editContact(@Req() r:AuthRequest,@Param('id') id:string,@Param('contact') contact:string,@Body() b:unknown){csrf(r);return this.partners.saveContact(r.user,id,contact,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/addresses')@Permission('partner.write')address(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.partners.addAddress(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
