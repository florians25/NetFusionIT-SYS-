import {Controller,Get,Query,Req,Res,UseGuards} from '@nestjs/common';
import {Response} from 'express';
import {AuthRequest,SessionGuard} from './auth';
import {Permission} from './permissions';
import {SalesReporting} from './sales-reporting';
@Controller('api/reporting')@UseGuards(SessionGuard)@Permission('reporting.sales.read')
export class SalesReportingController{
 constructor(private reports:SalesReporting){}
 @Get('configuration')configuration(@Req() r:AuthRequest){return this.reports.configuration(r.user);}
 @Get('sales/context')context(@Req() r:AuthRequest,@Query() q:unknown){return this.reports.context(r.user,q);}
 @Get('sales')sales(@Req() r:AuthRequest,@Query() q:unknown){return this.reports.sales(r.user,q);}
 @Get('sales.csv')async csv(@Req() r:AuthRequest,@Query() q:unknown,@Res() res:Response){const f=await this.reports.csv(r.user,q,r.correlationId);res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(f.filename),'Cache-Control':'private, no-store'}).send(f.data);}
}
