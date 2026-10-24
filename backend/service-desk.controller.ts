import{Controller,Get,Post,Param,Body,Req,UseGuards}from'@nestjs/common';import{AuthRequest,SessionGuard,csrf}from'./auth';import{ServiceDesk}from'./service-desk';import{Collaboration}from'./collaboration';
@Controller('api/service-desk')@UseGuards(SessionGuard)export class ServiceDeskController{
 constructor(private service:ServiceDesk,private collaboration:Collaboration){}
 @Get('library')library(@Req()r:AuthRequest){return this.service.library(r.user);}
 @Post('playbooks')playbook(@Req()r:AuthRequest,@Body()b:unknown){csrf(r);return this.service.createPlaybook(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('playbooks/:id/content')editPlaybook(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.editLibrary(r.user,id,false,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('articles/:id/content')editArticle(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.editLibrary(r.user,id,true,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('playbooks/:id/status')playbookStatus(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.libraryStatus(r.user,id,false,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('articles')article(@Req()r:AuthRequest,@Body()b:unknown){csrf(r);return this.service.createArticle(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('articles/:id/status')articleStatus(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.libraryStatus(r.user,id,true,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('tickets/:id')context(@Req()r:AuthRequest,@Param('id')id:string){return this.service.ticketContext(r.user,id);}
 @Post('tickets/:id/watchers')watch(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.watch(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/watchers/:watcher/remove')unwatch(@Req()r:AuthRequest,@Param('id')id:string,@Param('watcher')watcher:string,@Body()b:unknown){csrf(r);return this.service.unwatch(r.user,id,watcher,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/relations')relation(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.collaboration.link(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/knowledge')knowledge(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.linkKnowledge(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/tasks/:task/checklists')assignChecklist(@Req()r:AuthRequest,@Param('id')id:string,@Param('task')task:string,@Body()b:unknown){csrf(r);return this.service.assignChecklist(r.user,id,task,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('tickets/:id/tasks/:task/items/:item')checkItem(@Req()r:AuthRequest,@Param('id')id:string,@Param('task')task:string,@Param('item')item:string,@Body()b:unknown){csrf(r);return this.service.checkItem(r.user,id,task,item,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('assets/:id/history')asset(@Req()r:AuthRequest,@Param('id')id:string){return this.service.assetHistory(r.user,id);}
 @Get('partners/:id')partner(@Req()r:AuthRequest,@Param('id')id:string){return this.service.partnerContext(r.user,id);}
 @Post('partners/:id/activities')activity(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.createActivity(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('activities/:id/status')activityStatus(@Req()r:AuthRequest,@Param('id')id:string,@Body()b:unknown){csrf(r);return this.service.activityStatus(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
