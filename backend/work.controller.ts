import { Controller,Get,Post,Param,Body,Req,UseGuards } from '@nestjs/common';
import { AuthRequest,SessionGuard,csrf } from './auth';
import { Permission } from './permissions';
import { Work } from './work';
@Controller('api')@UseGuards(SessionGuard)
export class WorkController {
 constructor(private work:Work){}
 @Get('service/tasks/:id')@Permission('service.read')taskContext(@Req() r:AuthRequest,@Param('id') id:string){return this.work.task(r.user,id);}
 @Get('tickets/:id/execution')@Permission('service.read')ticket(@Req() r:AuthRequest,@Param('id') id:string){return this.work.ticketExecution(r.user,id);}
 @Post('tickets/:id/tasks')@Permission('order.execute')task(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.work.createTask(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/tasks/:task/order')@Permission('order.execute')taskOrder(@Req() r:AuthRequest,@Param('id') id:string,@Param('task') task:string,@Body() b:unknown){csrf(r);return this.work.assignTaskOrder(r.user,id,task,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/tasks/:task/complete')@Permission('order.execute')completeTask(@Req() r:AuthRequest,@Param('id') id:string,@Param('task') task:string,@Body() b:unknown){csrf(r);return this.work.completeTask(r.user,id,task,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/tasks/:task/cancel')@Permission('order.execute')cancelTask(@Req() r:AuthRequest,@Param('id') id:string,@Param('task') task:string,@Body() b:unknown){csrf(r);return this.work.cancelTask(r.user,id,task,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/times')@Permission('order.execute')manual(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.work.manual(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/timer')@Permission('order.execute')start(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.work.start(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/timer/:action')@Permission('order.execute')timer(@Req() r:AuthRequest,@Param('id') id:string,@Param('action') action:string,@Body() b:unknown){csrf(r);return this.work.timer(r.user,id,action,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/charges')@Permission('order.execute')charge(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.work.charge(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/times/:entry/allocate')@Permission('order.execute')allocateTime(@Req() r:AuthRequest,@Param('id') id:string,@Param('entry') entry:string,@Body() b:unknown){csrf(r);return this.work.allocate(r.user,id,entry,false,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/charges/:entry/allocate')@Permission('order.execute')allocateCharge(@Req() r:AuthRequest,@Param('id') id:string,@Param('entry') entry:string,@Body() b:unknown){csrf(r);return this.work.allocate(r.user,id,entry,true,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/times/:entry/void')@Permission('order.execute')voidTime(@Req() r:AuthRequest,@Param('id') id:string,@Param('entry') entry:string,@Body() b:unknown){csrf(r);return this.work.voidTime(r.user,id,entry,false,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/charges/:entry/void')@Permission('order.execute')voidCharge(@Req() r:AuthRequest,@Param('id') id:string,@Param('entry') entry:string,@Body() b:unknown){csrf(r);return this.work.voidTime(r.user,id,entry,true,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('service/orders/:id/execution')@Permission('order.read')execution(@Req() r:AuthRequest,@Param('id') id:string){return this.work.execution(r.user,id);}
 @Get('service/reports/:id')@Permission('order.read')report(@Req() r:AuthRequest,@Param('id') id:string){return this.work.report(r.user,id);}
 @Post('service/reports/:id/cancel')@Permission('order.execute')cancel(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.work.cancelReport(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('service/reports/:id/confirm')@Permission('order.read')confirm(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.work.confirm(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('service/orders/:id/complete')@Permission('work.approve')complete(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.work.complete(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('service/orders/:id/billing-ready')@Permission('billing.write')billing(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.work.billingReady(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
