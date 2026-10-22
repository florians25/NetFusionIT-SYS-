import {Controller,Get,Post,Param,Body,Req,UseGuards} from '@nestjs/common';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {Inventory} from './inventory';
@Controller('api')@UseGuards(SessionGuard)@Permission('inventory.read')
export class InventoryController{
 constructor(private inventory:Inventory){}
 @Get('inventory/companies')companies(@Req() r:AuthRequest){return this.inventory.companies(r.user);}
 @Get('inventory/companies/:id')context(@Req() r:AuthRequest,@Param('id') id:string){return this.inventory.context(r.user,id);}
 @Post('inventory/companies/:id/plants')@Permission('inventory.write')plant(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.inventory.plant(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('inventory/companies/:id/locations')@Permission('inventory.write')location(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.inventory.location(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('inventory/materials/:id/settings')@Permission('material.write')settings(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.inventory.settings(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('procurement/documents/:id/receiving-context')contextForReceipt(@Req() r:AuthRequest,@Param('id') id:string){return this.inventory.receivingContext(r.user,id);}
 @Post('procurement/documents/:id/receipts')@Permission('inventory.write')receive(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.inventory.receive(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('inventory/receipts/:id')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.inventory.detail(r.user,id);}
 @Post('inventory/receipts/:id/reverse')@Permission('inventory.write')reverse(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.inventory.reverse(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
