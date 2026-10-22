import { Controller,Get,Post,Patch,Body,Param,Req,UseGuards } from '@nestjs/common';
import { AuthRequest,SessionGuard,csrf } from './auth';
import { Permission } from './permissions';
import { Operations } from './operations';
import { Dispatch } from './dispatch';
import { Sla } from './sla';
@Controller('api')@UseGuards(SessionGuard)
export class OperationsController {
 constructor(private ops:Operations,private dispatch:Dispatch,private sla:Sla){}
 @Get('service/context-partners')@Permission('service.read')contextPartners(@Req() r:AuthRequest){return this.ops.contextPartners(r.user);}
 @Get('service/calendars')@Permission('service.config.read')calendars(@Req() r:AuthRequest){return this.ops.calendars(r.user);}
 @Post('service/calendars')@Permission('service.manage')calendar(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.ops.saveCalendar(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('service/sla-policies')@Permission('service.config.read')policies(@Req() r:AuthRequest){return this.ops.policies(r.user);}
 @Post('service/sla-policies')@Permission('service.manage')policy(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.ops.createPolicy(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('service/contracts')@Permission('contract.read')contracts(@Req() r:AuthRequest){return this.ops.contracts(r.user);}
 @Post('service/contracts')@Permission('contract.write')contract(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.ops.createContract(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('service/contracts/:id/status')@Permission('contract.write')contractStatus(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.ops.activateContract(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('service/assets')@Permission('asset.read')assets(@Req() r:AuthRequest){return this.ops.assets(r.user);}
 @Post('service/assets')@Permission('asset.write')asset(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.ops.createAsset(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('service/cases/:id/objects')@Permission('asset.write')linkObject(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.ops.linkObject(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('tickets/:id/sla')@Permission('service.read')ticketSla(@Req() r:AuthRequest,@Param('id') id:string){return this.sla.detail(r.user,id);}
 @Post('service/sla-sweep')@Permission('service.manage')sweep(@Req() r:AuthRequest){csrf(r);return this.sla.sweep(r.user);}
 @Get('dispatch/technicians')@Permission('service.read')technicians(@Req() r:AuthRequest){return this.dispatch.technicianProfiles(r.user);}
 @Patch('dispatch/technicians/:id')@Permission('service.assign')profile(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.dispatch.profile(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('dispatch/absences')@Permission('service.assign')absences(@Req() r:AuthRequest){return this.dispatch.absences(r.user);}
 @Post('dispatch/absences')@Permission('service.assign')absence(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.dispatch.absence(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('dispatch/visits')@Permission('service.read')visits(@Req() r:AuthRequest){return this.dispatch.visits(r.user);}
 @Post('dispatch/visits')@Permission('service.assign')visit(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.dispatch.create(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('dispatch/visits/:id/status')@Permission('service.read')visitStatus(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.dispatch.status(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('dispatch/recommendations')@Permission('service.assign')recommend(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.dispatch.recommendations(r.user,b);}
}
