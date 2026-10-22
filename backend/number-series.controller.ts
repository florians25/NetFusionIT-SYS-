import {Controller,Get,Patch,Param,Body,Req,UseGuards} from '@nestjs/common';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {NumberSeries} from './number-series';
@Controller('api/admin/number-series')@UseGuards(SessionGuard)@Permission('admin.write')
export class NumberSeriesController{
 constructor(private numbers:NumberSeries){}
 @Get()list(@Req() r:AuthRequest){return this.numbers.list(r.user);}
 @Patch(':prefix')change(@Req() r:AuthRequest,@Param('prefix') p:string,@Body() b:unknown){csrf(r);return this.numbers.change(r.user,p,b,r.get('Idempotency-Key'),r.correlationId);}
}
