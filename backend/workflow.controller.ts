import { Controller,Get,Post,Patch,Body,Param,Req,UseGuards } from '@nestjs/common';
import { AuthRequest,SessionGuard,csrf } from './auth';
import { Permission } from './permissions';
import { Workflow } from './workflow';
import { Db } from './core';
import { Collaboration } from './collaboration';
@Controller('api')@UseGuards(SessionGuard)
export class WorkflowController {
 constructor(private workflow:Workflow,private collaboration:Collaboration,private db:Db){}
 @Get('organization')organization(@Req() r:AuthRequest){return this.db.as(r.user,async db=>(await db.query('SELECT id,name,kind,parent_id AS "parentId" FROM organizations WHERE tenant_id=$1 AND id=ANY($2::uuid[]) ORDER BY name',[r.user.tenantId,r.user.orgIds])).rows);}
 @Get('workflow/definitions')@Permission('workflow.read')definitions(@Req() r:AuthRequest){return this.workflow.definitions(r.user);}
 @Post('workflow/definitions')@Permission('workflow.configure')configure(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.workflow.configure(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('workflow/inbox')@Permission('workflow.read')inbox(@Req() r:AuthRequest){return this.workflow.inbox(r.user);}
 @Post('workflow/submit/:id')@Permission('workflow.read')submit(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.workflow.submit(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('workflow/instances/:id/decisions')@Permission('workflow.read')decisions(@Req() r:AuthRequest,@Param('id') id:string){return this.workflow.decisions(r.user,id);}
 @Post('workflow/instances/:id/decide')@Permission('workflow.read')decide(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.workflow.decide(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('tickets/:id/comments')@Permission('service.read')comments(@Req() r:AuthRequest,@Param('id') id:string){return this.collaboration.comments(r.user,id);}
 @Post('tickets/:id/comments')@Permission('service.read')comment(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.collaboration.comment(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/links')@Permission('service.manage')link(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.collaboration.link(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('partners/:id')@Permission('partner.read')partner(@Req() r:AuthRequest,@Param('id') id:string){return this.collaboration.partner(r.user,id);}
 @Patch('partners/:id')@Permission('partner.write')updatePartner(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.collaboration.partnerUpdate(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('notifications')notifications(@Req() r:AuthRequest){return this.collaboration.notifications(r.user);}
 @Post('notifications/:id/read')read(@Req() r:AuthRequest,@Param('id') id:string){csrf(r);return this.collaboration.readNotification(r.user,id);}
}
