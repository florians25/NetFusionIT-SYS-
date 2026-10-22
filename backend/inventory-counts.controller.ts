import {Controller,Get,Post,Param,Body,Req,UseGuards} from '@nestjs/common';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {InventoryCounts} from './inventory-counts';
@Controller('api/inventory-counts')@UseGuards(SessionGuard)@Permission('inventory.read')
export class InventoryCountsController{
 constructor(private counts:InventoryCounts){}
 @Get('companies/:id')list(@Req() r:AuthRequest,@Param('id') id:string){return this.counts.list(r.user,id);}
 @Get(':id')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.counts.detail(r.user,id);}
 @Post()@Permission('inventory.write')create(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.counts.create(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/lines/:lineId/count')@Permission('inventory.write')capture(@Req() r:AuthRequest,@Param('id') id:string,@Param('lineId') lineId:string,@Body() b:unknown){csrf(r);return this.counts.capture(r.user,id,lineId,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/bins/:binId/empty')@Permission('inventory.write')empty(@Req() r:AuthRequest,@Param('id') id:string,@Param('binId') binId:string,@Body() b:unknown){csrf(r);return this.counts.confirmEmpty(r.user,id,binId,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/lines')@Permission('inventory.write')addLine(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.counts.addLine(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/prepare')@Permission('inventory.count.prepare')prepare(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.counts.prepare(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/withdraw')@Permission('inventory.count.prepare')withdraw(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.counts.withdraw(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/post')@Permission('finance.write')post(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.counts.post(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/reverse')@Permission('inventory.write')reverse(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.counts.reverse(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post(':id/cancel')@Permission('inventory.write')cancel(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.counts.cancel(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
