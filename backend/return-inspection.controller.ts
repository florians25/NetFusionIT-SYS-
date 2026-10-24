import{Controller,Get,Post,Req,Param,Body,UseGuards,BadRequestException}from'@nestjs/common';import{AuthRequest,SessionGuard,csrf}from'./auth';import{Permission}from'./permissions';import{ReturnInspection}from'./return-inspection';
@Controller('api/return-inspection')@UseGuards(SessionGuard)@Permission('sales.return.read')export class ReturnInspectionController{
 constructor(private service:ReturnInspection){}
 @Get('returns/:id')context(@Req()r:AuthRequest,@Param('id')id:string){return this.service.context(r.user,id);}
 @Get('records/:id')record(@Req()r:AuthRequest,@Param('id')id:string){return this.service.record(r.user,id);}
 @Post('returns/:id/:action')action(@Req()r:AuthRequest,@Param('id')id:string,@Param('action')action:string,@Body()b:unknown){csrf(r);if(!['arrival','inspect','dispatch','reverse-custody','reverse-inspection'].includes(action))throw new BadRequestException('Unbekannte Prüfaktion');return this.service.action(r.user,id,action as any,b,r.get('Idempotency-Key'),r.correlationId);}
}
