import { ForbiddenException, SetMetadata } from '@nestjs/common';
export const ROLES=['ADMIN','SERVICE_MANAGER','DISPATCHER','SUPPORT','TECHNICIAN','FIELD_TECHNICIAN','MASTER_DATA','BUYER','PURCHASING_MANAGER','WAREHOUSE','SALES','BILLING','ACCOUNTANT','CONTROLLER','EXECUTIVE','CUSTOMER'] as const;
export type Role=typeof ROLES[number];
const service:Role[]=['ADMIN','SERVICE_MANAGER','DISPATCHER','SUPPORT','TECHNICIAN','FIELD_TECHNICIAN','CUSTOMER'];
export const grants:Record<string,readonly Role[]>={
 'service.read':service,'service.create':['ADMIN','SERVICE_MANAGER','DISPATCHER','SUPPORT','CUSTOMER'],
 'service.manage':['ADMIN','SERVICE_MANAGER','DISPATCHER','SUPPORT'],
 'service.assign':['ADMIN','SERVICE_MANAGER','DISPATCHER'],
 'partner.read':['ADMIN','SERVICE_MANAGER','DISPATCHER','SUPPORT','MASTER_DATA','BUYER','PURCHASING_MANAGER','SALES','BILLING','ACCOUNTANT','EXECUTIVE','CUSTOMER'],
 'partner.write':['ADMIN','MASTER_DATA'],
 'workflow.read':ROLES.filter(r=>r!=='CUSTOMER'), 'workflow.configure':['ADMIN'],
 'asset.read':service,'asset.write':['ADMIN','SERVICE_MANAGER','SUPPORT','TECHNICIAN','FIELD_TECHNICIAN'],
 'contract.read':service,'contract.write':['ADMIN','SERVICE_MANAGER','SALES'],
 'inventory.read':['ADMIN','SERVICE_MANAGER','DISPATCHER','SUPPORT','TECHNICIAN','FIELD_TECHNICIAN','BUYER','PURCHASING_MANAGER','WAREHOUSE','SALES','BILLING','ACCOUNTANT','CONTROLLER','EXECUTIVE'],
 'inventory.write':['ADMIN','WAREHOUSE'], 'material.write':['ADMIN','MASTER_DATA'],
 'procurement.read':['ADMIN','BUYER','PURCHASING_MANAGER','WAREHOUSE','ACCOUNTANT','CONTROLLER','EXECUTIVE'],
 'procurement.write':['ADMIN','BUYER','PURCHASING_MANAGER'],
 'sales.read':['ADMIN','SERVICE_MANAGER','SALES','BILLING','ACCOUNTANT','CONTROLLER','EXECUTIVE','CUSTOMER'],
 'sales.write':['ADMIN','SERVICE_MANAGER','SALES'],
 'billing.read':['ADMIN','BILLING','ACCOUNTANT','CONTROLLER','EXECUTIVE','CUSTOMER'],
 'billing.write':['ADMIN','BILLING'], 'finance.read':['ADMIN','ACCOUNTANT','CONTROLLER','EXECUTIVE'],
 'finance.write':['ADMIN','ACCOUNTANT'], 'reporting.read':['ADMIN','CONTROLLER','EXECUTIVE'],
 'admin.write':['ADMIN']
};
export function can(role:Role,permission:string){return grants[permission]?.includes(role)||false;}
export function requirePermission(role:Role,permission:string){if(!can(role,permission))throw new ForbiddenException('Keine Berechtigung für '+permission+'.');}
export const Permission=(permission:string)=>SetMetadata('permission',permission);
