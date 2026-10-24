import {Controller,Get,Post,Param,Query,Body,Req,UseGuards} from '@nestjs/common';import {SessionGuard,AuthRequest,csrf} from './auth';import {Permission} from './permissions';import {TicketIntake} from './ticket-intake';
@Controller('api/ticket-intake')@UseGuards(SessionGuard)@Permission('ticket.intake.read')
export class TicketIntakeController{
 constructor(private intake:TicketIntake){}
 @Get('new')@Permission('service.create')context(@Req()r:AuthRequest,@Query()q:unknown){return this.intake.newContext(r.user,q);}
 @Get(':id')detail(@Req()r:AuthRequest,@Param('id')id:string){return this.intake.detail(r.user,id);}
 @Post(':id')@Permission('ticket.intake.write')update(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.intake.update(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
