import {Controller,Get,Post,Patch,Param,Body,Req,UseGuards} from '@nestjs/common';
import {SessionGuard,AuthRequest,csrf} from './auth';
import {Permission} from './permissions';
import {PurchasingOrganization} from './purchasing-organization';
@Controller('api/procurement/configuration')@UseGuards(SessionGuard)
export class PurchasingOrganizationController{
 constructor(private purchasing:PurchasingOrganization){}
 @Get()@Permission('procurement.config.read')configuration(@Req()r:AuthRequest){return this.purchasing.configuration(r.user);}
 @Post(':kind')@Permission('procurement.configure')create(@Req()r:AuthRequest,@Param('kind')kind:string,@Body()b:unknown){csrf(r);return this.purchasing.create(r.user,kind,b,r.get('Idempotency-Key'),r.correlationId);}
 @Patch(':kind/:id')@Permission('procurement.configure')update(@Req()r:AuthRequest,@Param('kind')kind:string,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.purchasing.update(r.user,kind,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
