import {Controller,Get,Post,Param,Body,Req,Res,Query,UseGuards} from '@nestjs/common';
import {Response} from 'express';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {IncomingInvoices} from './incoming-invoices';
import {IncomingInvoiceMatching} from './incoming-invoice-matching';
import {SupplierPosting} from './supplier-posting';
import {SupplierReversals} from './supplier-reversals';
@Controller('api/incoming-invoices')@UseGuards(SessionGuard)@Permission('ap.read')
export class IncomingInvoicesController{
 constructor(private incoming:IncomingInvoices,private matching:IncomingInvoiceMatching,private posting:SupplierPosting,private reversals:SupplierReversals){}
 @Post(':id/reversal')reversal(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown){csrf(r);return this.reversals.create(r.user!,id,body,r.headers['idempotency-key'],r.correlationId!);}
 @Get('context')context(@Req() r:AuthRequest){return this.incoming.context(r.user);}
 @Get()list(@Req() r:AuthRequest){return this.incoming.list(r.user);}
 @Get(':id/financial')financial(@Req() r:AuthRequest,@Param('id') id:string){return this.posting.context(r.user,id);}
 @Post(':id/prepare')@Permission('ap.post')prepare(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.posting.prepare(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/withdraw')@Permission('ap.post')withdraw(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.posting.withdraw(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/post')@Permission('ap.post')post(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.posting.post(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get(':id/matching')matchingContext(@Req() r:AuthRequest,@Param('id') id:string){return this.matching.context(r.user,id);}
 @Post(':id/matching')@Permission('ap.receive')saveMatching(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.matching.save(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get(':id')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.incoming.detail(r.user,id);}
 @Post('receive')@Permission('ap.receive')receive(@Req() r:AuthRequest,@Query('companyId') company:unknown,@Query('filename') name:unknown,@Body() body:unknown){csrf(r);return this.incoming.receive(r.user,company,name,body,r.get('Content-Type')||'',r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/process')@Permission('ap.receive')process(@Req() r:AuthRequest,@Param('id') id:string){csrf(r);return this.incoming.process(r.user,id,r.correlationId);}
 @Post(':id/scan')@Permission('ap.receive')scan(@Req() r:AuthRequest,@Param('id') id:string){csrf(r);return this.incoming.rescan(r.user,id,r.correlationId);}
 @Post(':id/cancel')@Permission('ap.receive')cancel(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown){csrf(r);return this.incoming.cancel(r.user,id,body,r.get('Idempotency-Key'),r.correlationId);}
 @Get(':id/files/:kind')async file(@Req() r:AuthRequest,@Param('id') id:string,@Param('kind') kind:string,@Res() res:Response){if(!['original','xml','report'].includes(kind)){res.status(404).end();return;}const a=await this.incoming.download(r.user,id,kind as 'original'|'xml'|'report',r.correlationId);res.set({'Content-Type':a.mediaType,'Content-Disposition':`attachment; filename="${a.filename.replace(/[^\x20-\x7e]|["\\]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(a.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`,'Content-Length':String(a.content.length),'Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','X-Content-SHA256':a.sha256,'Cache-Control':'no-store'});res.send(a.content);}
}
