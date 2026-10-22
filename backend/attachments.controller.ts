import {Controller,Get,Post,Param,Body,Req,Res,Query,UseGuards} from '@nestjs/common';
import {Response} from 'express';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {Attachments} from './attachments';
@Controller('api/documents/:id/attachments')@UseGuards(SessionGuard)@Permission('document.read')
export class AttachmentsController{
 constructor(private attachments:Attachments){}
 @Get()list(@Req() r:AuthRequest,@Param('id') id:string){return this.attachments.list(r.user,id);}
 @Post('generate')@Permission('attachment.write')generate(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.attachments.generate(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('upload')@Permission('attachment.write')upload(@Req() r:AuthRequest,@Param('id') id:string,@Query('filename') name:unknown,@Body() b:unknown){csrf(r);return this.attachments.upload(r.user,id,b,name,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':attachmentId/scan')@Permission('attachment.write')scan(@Req() r:AuthRequest,@Param('id') id:string,@Param('attachmentId') attachment:string){csrf(r);return this.attachments.rescan(r.user,id,attachment,r.get('Idempotency-Key'),r.correlationId);}
 @Get(':attachmentId/download')async download(@Req() r:AuthRequest,@Param('id') id:string,@Param('attachmentId') attachment:string,@Res() res:Response){const a=await this.attachments.download(r.user,id,attachment,r.correlationId);res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${a.filename.replace(/[^\x20-\x7e]|["\\]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(a.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`,'Content-Length':String(a.content.length),'Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','X-Content-SHA256':a.sha256,'Cache-Control':'no-store'});res.send(a.content);}
}
