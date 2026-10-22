import { Controller, Get,Post,Patch,Body,Param,Req,Res,UseGuards,HttpCode,ServiceUnavailableException } from '@nestjs/common';
import { Response } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AuthRequest,AuthService,SessionGuard,Roles,csrf } from './auth';
import { Service } from './service';
import { Admin } from './admin';
import { OData,metadata,entityFields } from './odata';
import { Db,parse,audit } from './core';
@Controller('health')
export class HealthController {
  constructor(private db:Db){}
  @Get('live')live(){return {status:'ok'};}
  @Get('ready')async ready(){try{const r=await this.db.pool.query("SELECT to_regclass('public.tickets') IS NOT NULL AND to_regclass('public.sessions') IS NOT NULL AS ready");if(!r.rows[0].ready)throw new Error();return {status:'ready',database:'postgresql'};}catch{throw new ServiceUnavailableException('Datenbank oder Schema nicht bereit.');}}
}
@Controller('api/auth')
export class AuthController {
  constructor(private auth:AuthService,private db:Db){}
  @Get('session')async session(@Req() req:AuthRequest){
    req.session.csrf||=randomBytes(32).toString('hex');
    const user=req.session.userId&&req.session.authenticatedAt&&Date.now()-req.session.authenticatedAt<8*60*60*1000?await this.auth.resolve(req.session.userId):null;
    return {user:user||null,csrfToken:req.session.csrf};
  }
  @Post('login')@HttpCode(200)async login(@Req() req:AuthRequest,@Body() raw:unknown){
    csrf(req);
    const data=parse(z.object({tenant:z.string().regex(/^[a-z0-9-]{2,48}$/),email:z.email().max(254),password:z.string().min(1).max(128)}).strict(),raw);
    const user=await this.auth.login(data.tenant,data.email,data.password);
    await new Promise<void>((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
    req.session.userId=user.id;req.session.authenticatedAt=Date.now();req.session.csrf=randomBytes(32).toString('hex');
    await this.db.as(user,db=>audit(db,user,req.correlationId,'LOGIN',null));
    return {user,csrfToken:req.session.csrf};
  }
  @Post('logout')@HttpCode(200)async logout(@Req() req:AuthRequest,@Res({passthrough:true}) res:Response){
    csrf(req);await new Promise<void>((resolve,reject)=>req.session.destroy(e=>e?reject(e):resolve()));
    res.clearCookie('nf.sid',{path:'/'});return {ok:true};
  }
}
@Controller('api')@UseGuards(SessionGuard)
export class ApiController {
  constructor(private service:Service,private admin:Admin){}
  @Get('dashboard')dashboard(@Req() r:AuthRequest){return this.service.dashboard(r.user);}
  @Get('partners')@Roles('ADMIN','DISPATCHER','SUPPORT','CUSTOMER')partners(@Req() r:AuthRequest){return this.service.partners(r.user);}
  @Post('partners')@Roles('ADMIN')partner(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.admin.createPartner(r.user,b,r.correlationId);}
  @Get('technicians')@Roles('ADMIN','DISPATCHER','SUPPORT')technicians(@Req() r:AuthRequest){return this.service.technicians(r.user);}
  @Post('tickets')@Roles('ADMIN','DISPATCHER','SUPPORT','CUSTOMER')create(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.service.create(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
  @Get('tickets/:id')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.service.detail(r.user,id);}
  @Post('tickets/:id/assign')@Roles('ADMIN','DISPATCHER')assign(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.service.assign(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
  @Post('tickets/:id/status')@Roles('ADMIN','DISPATCHER','SUPPORT','TECHNICIAN')status(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.service.status(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
  @Get('cases/:id')serviceCase(@Req() r:AuthRequest,@Param('id') id:string){return this.service.serviceCase(r.user,id);}
  @Get('documents/:id/flow')flow(@Req() r:AuthRequest,@Param('id') id:string){return this.service.flow(r.user,id);}
  @Get('admin/organization')@Roles('ADMIN')org(@Req() r:AuthRequest){return this.admin.organization(r.user);}
  @Get('admin/users')@Roles('ADMIN')users(@Req() r:AuthRequest){return this.admin.users(r.user);}
  @Post('admin/users')@Roles('ADMIN')createUser(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.admin.createUser(r.user,b,r.correlationId);}
  @Patch('admin/users/:id')@Roles('ADMIN')updateUser(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.admin.updateUser(r.user,id,b,r.correlationId);}
}
@Controller('odata')
export class ODataController {
  constructor(private odata:OData){}
  @Get()@UseGuards(SessionGuard)root(){return {'@odata.context':'/odata/$metadata',value:Object.keys(entityFields).map(name=>({name,kind:'EntitySet',url:name}))};}
  @Get('$metadata')meta(@Res() res:Response){res.type('application/xml').set('OData-Version','4.0').send(metadata());}
  @Get('*resource')@UseGuards(SessionGuard)read(@Req() req:AuthRequest,@Res({passthrough:true}) res:Response){res.set('OData-Version','4.0');return this.odata.read(req.user,decodeURIComponent(req.path.replace(/^\/odata\//,'')),req.query);}
}
