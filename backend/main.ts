import 'reflect-metadata';
import { Module,Catch,ExceptionFilter,ArgumentsHost,HttpException,Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Db } from './core';
import { AuthService,SessionGuard,AuthRequest } from './auth';
import { Service } from './service';
import { Admin } from './admin';
import { OData } from './odata';
import { HealthController,AuthController,ApiController,ODataController } from './controllers';
import { Commerce } from './commerce';
import { CommerceController } from './commerce.controller';
import { Work } from './work';
import { WorkController } from './work.controller';
import {NumberSeries} from './number-series';
import {NumberSeriesController} from './number-series.controller';
import { MaterialPlanning } from './material-planning';
import { MaterialPlanningController } from './material-planning.controller';
import { Inventory } from './inventory';
import { InventoryController } from './inventory.controller';
import { Procurement } from './procurement';
import { ProcurementController } from './procurement.controller';
import { Finance } from './finance';
import { FinanceController } from './finance.controller';
import { Workflow } from './workflow';
import { Collaboration } from './collaboration';
import { WorkflowController } from './workflow.controller';
import { Sla } from './sla';
import { Operations } from './operations';
import { Dispatch } from './dispatch';
import { OperationsController } from './operations.controller';
@Module({controllers:[NumberSeriesController,MaterialPlanningController,InventoryController,ProcurementController,FinanceController,WorkController,CommerceController,HealthController,AuthController,ApiController,ODataController,WorkflowController,OperationsController],providers:[NumberSeries,MaterialPlanning,Inventory,Procurement,Finance,Work,Commerce,Db,AuthService,SessionGuard,Service,Admin,OData,Workflow,Collaboration,Sla,Operations,Dispatch]})
class AppModule{}
@Catch()
class SafeErrors implements ExceptionFilter {
  catch(error:any,host:ArgumentsHost){
    const ctx=host.switchToHttp(),res=ctx.getResponse(),req=ctx.getRequest<AuthRequest>();
    const inputError=['entity.parse.failed','entity.too.large'].includes(error.type);
    let status=error instanceof HttpException?error.getStatus():inputError?(error.type==='entity.too.large'?413:400):error.code==='23505'?409:500;
    const raw=error instanceof HttpException?error.getResponse():null;
    const message=status===500?'Interner Fehler. Bitte Korrelations-ID an den Support weitergeben.':inputError?'JSON-Anfrage ungültig oder zu groß.':status===409&&!raw?'Datensatz oder eindeutiger Wert bereits vorhanden.':typeof raw==='string'?raw:(raw as any)?.message||'Anfrage fehlgeschlagen.';
    if(status===500) console.error(JSON.stringify({level:'error',event:'request_failed',correlationId:req.correlationId,type:error.constructor?.name,code:error.code}));
    res.status(status).json({error:{code:String(status),message,correlationId:req.correlationId}});
  }
}
async function main(){
  const secret=process.env.ERP_SESSION_SECRET;
  if(!secret||secret.length<48)throw new Error('ERP_SESSION_SECRET muss mindestens 48 Zeichen besitzen.');
  const prod=process.env.NODE_ENV==='production';
  if(prod&&!process.env.ERP_PUBLIC_ORIGIN?.startsWith('https://'))throw new Error('Produktion benötigt ERP_PUBLIC_ORIGIN mit HTTPS.');
  const app=await NestFactory.create(AppModule,{bodyParser:false,logger:['warn','error']});
  const capabilities=await app.get(Db).pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  if(capabilities.rows[0].rolsuper||capabilities.rows[0].rolbypassrls)throw new Error('API darf nicht mit Superuser oder BYPASSRLS starten.');
  const server=app.getHttpAdapter().getInstance();
  server.disable('x-powered-by');
  if(process.env.ERP_TRUST_PROXY==='1')server.set('trust proxy',1);
  app.use((req:any,res:any,next:any)=>{req.correlationId=randomUUID();res.set('X-Correlation-ID',req.correlationId);next();});
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:'],fontSrc:["'self'",'data:'],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:prod?[]:null}},crossOriginEmbedderPolicy:false}));
  app.use('/api',express.json({limit:'32kb'}));
  const limited=(req:any,res:any)=>res.status(429).json({error:{code:'429',message:'Zu viele Anfragen. Bitte später erneut versuchen.',correlationId:req.correlationId}});
  app.use('/api',rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-8',legacyHeaders:false,handler:limited}));
  app.use('/api/auth/login',rateLimit({windowMs:15*60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,skipSuccessfulRequests:true,handler:limited}));
  const store=new (connectPgSimple(session))({pool:app.get(Db).pool,tableName:'sessions',createTableIfMissing:false,pruneSessionInterval:60});
  app.use(['/api','/odata'],session({name:'nf.sid',secret,store,resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:prod,sameSite:'lax',maxAge:8*60*60*1000}}));
  app.use(['/api','/odata'],(req:any,res:any,next:any)=>{res.set('Cache-Control','no-store');next();});
  const root=path.resolve(__dirname,'..');
  app.use('/resources',express.static(path.join(root,'ui5-dist','resources'),{maxAge:prod?'1d':0}));
  app.use('/',express.static(path.join(root,'ui5-dist'),{index:'index.html',maxAge:0}));
  app.useGlobalFilters(new SafeErrors());app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT||3000),process.env.ERP_HOST||'127.0.0.1');
  console.log(JSON.stringify({level:'info',event:'server_ready',port:Number(process.env.PORT||3000),mode:prod?'production':'development'}));
}
main().catch(e=>{console.error(JSON.stringify({level:'error',event:'startup_failed',message:e.message}));process.exitCode=1;});
