import {Controller,Get,Post,Param,Body,Query,Req,Res,UseGuards} from '@nestjs/common';import {Response} from 'express';import {AuthRequest,SessionGuard,csrf} from './auth';import {EnterpriseReporting} from './enterprise-reporting';
@Controller('api/enterprise-reporting') @UseGuards(SessionGuard)
export class EnterpriseReportingController{
 constructor(private service:EnterpriseReporting){}
 @Get(':kind/configuration')configuration(@Req()r:AuthRequest,@Param('kind')kind:string){return this.service.configuration(r.user,kind);}
 @Get(':kind/variants')variants(@Req()r:AuthRequest,@Param('kind')kind:string){return this.service.variants(r.user,kind);}
 @Post(':kind/variants')save(@Req()r:AuthRequest,@Param('kind')kind:string,@Body()b:unknown){csrf(r);return this.service.saveVariant(r.user,kind,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':kind/variants/:id/delete')remove(@Req()r:AuthRequest,@Param('kind')kind:string,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.deleteVariant(r.user,kind,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get(':kind/data')data(@Req()r:AuthRequest,@Param('kind')kind:string,@Query()q:unknown){return this.service.run(r.user,kind,q);}
 @Get(':kind/export')async csv(@Req()r:AuthRequest,@Param('kind')kind:string,@Query()q:unknown,@Res()res:Response){const f=await this.service.csv(r.user,kind,q,r.correlationId);res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(f.filename),'Cache-Control':'private, no-store'}).send(f.data);}
}
