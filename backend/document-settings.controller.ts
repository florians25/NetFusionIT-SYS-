import {Controller,Get,Put,Param,Body,Req,UseGuards} from '@nestjs/common';
import {SessionGuard,AuthRequest,csrf} from './auth';
import {Permission} from './permissions';
import {DocumentSettings} from './document-settings';
@Controller('api/document-settings')@UseGuards(SessionGuard)
export class DocumentSettingsController{
 constructor(private settings:DocumentSettings){}
 @Get()@Permission('document.config.read')list(@Req()r:AuthRequest){return this.settings.list(r.user);}
 @Put(':id')@Permission('document.configure')save(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.settings.save(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
