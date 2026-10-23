import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, SetMetadata, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { randomBytes, scrypt as rawScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Db, Principal, Role } from './core';
import { requirePermission,grants,can } from './permissions';
declare module 'express-session' { interface SessionData { userId?:string; csrf?:string; authenticatedAt?:number; } }
export interface AuthRequest extends Request { user:Principal; correlationId:string; }
const scrypt=promisify(rawScrypt);
export async function hashPassword(password:string){
  const salt=randomBytes(24).toString('hex'), key=await scrypt(password,salt,64) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
async function verify(password:string,hash:string){
  const [kind,salt,encoded]=hash.split(':');
  if(kind!=='scrypt'||!salt||!encoded)return false;
  const expected=Buffer.from(encoded,'hex'), actual=await scrypt(password,salt,64) as Buffer;
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export const Roles=(...roles:Role[])=>SetMetadata('roles',roles);
@Injectable()
export class AuthService {
  constructor(private db:Db){}
  async resolve(id:string):Promise<Principal|null>{
    const r=await this.db.pool.query(`SELECT u.id,u.tenant_id AS "tenantId",t.name AS "tenantName",t.slug AS "tenantSlug",u.name,u.first_name AS "firstName",u.last_name AS "lastName",u.email,u.role,u.partner_id AS "partnerId",coalesce(array_agg(o.organization_id) FILTER(WHERE o.organization_id IS NOT NULL),'{}') AS "orgIds" FROM users u JOIN tenants t ON t.id=u.tenant_id LEFT JOIN user_organizations o ON o.tenant_id=u.tenant_id AND o.user_id=u.id WHERE u.id=$1 AND u.active GROUP BY u.id,t.id`,[id]);
    return r.rows[0]?{...r.rows[0],permissions:Object.keys(grants).filter(permission=>can(r.rows[0].role,permission))}:null;
  }
  async login(tenant:string,email:string,password:string){
    const r=await this.db.pool.query('SELECT u.id,u.password_hash FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE t.slug=$1 AND u.email=$2 AND u.active',[tenant,email.toLowerCase()]);
    // Auch unbekannte Benutzer durchlaufen scrypt.
    const dummy='scrypt:000000000000000000000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
    const valid=await verify(password,r.rows[0]?.password_hash||dummy);
    if(!valid||!r.rowCount) throw new UnauthorizedException('Anmeldung nicht möglich. Zugangsdaten prüfen.');
    return (await this.resolve(r.rows[0].id))!;
  }
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private auth:AuthService,private reflector:Reflector){}
  async canActivate(ctx:ExecutionContext){
    const req=ctx.switchToHttp().getRequest<AuthRequest>();
    if(!req.session.userId)throw new UnauthorizedException('Bitte anmelden.');
    if(!req.session.authenticatedAt||Date.now()-req.session.authenticatedAt>8*60*60*1000){req.session.destroy(()=>{});throw new UnauthorizedException('Sitzung abgelaufen.');}
    const user=await this.auth.resolve(req.session.userId);
    if(!user){req.session.destroy(()=>{});throw new UnauthorizedException('Zugang nicht aktiv.');}
    const roles=this.reflector.getAllAndOverride<Role[]>('roles',[ctx.getHandler(),ctx.getClass()]);
    if(roles&&!roles.includes(user.role))throw new ForbiddenException('Keine Berechtigung für diese Aktion.');
    const permission=this.reflector.getAllAndOverride<string>('permission',[ctx.getHandler(),ctx.getClass()]);
    if(permission)requirePermission(user.role,permission);
    if(!user.orgIds.length)throw new ForbiddenException('Keine Organisationszuordnung.');
    req.user=user;return true;
  }
}
export function csrf(req:Request){
  const actual=req.get('X-CSRF-Token');
  if(!req.session.csrf||!actual||!/^[a-f0-9]{64}$/.test(actual)||!timingSafeEqual(Buffer.from(actual),Buffer.from(req.session.csrf)))throw new ForbiddenException('Ungültiger CSRF-Token. Bitte Seite neu laden.');
  const origin=req.get('Origin');
  if(origin){
    const allowed=process.env.ERP_PUBLIC_ORIGIN||`${req.protocol}://${req.get('host')}`;
    if(origin!==allowed)throw new ForbiddenException('Origin nicht zugelassen.');
  }
}
