import {Controller,Get,Post,Patch,Param,Body,Query,Req,Res,UseGuards} from '@nestjs/common';
import {Response} from 'express';
import {AuthRequest,SessionGuard,csrf} from './auth';
import {Permission} from './permissions';
import {Warehouse} from './warehouse';
@Controller('api/warehouse')@UseGuards(SessionGuard)@Permission('inventory.read')
export class WarehouseController{
 constructor(private warehouse:Warehouse){}
 @Get('companies/:id')context(@Req() r:AuthRequest,@Param('id') id:string){return this.warehouse.context(r.user,id);}
 @Get('scan')scan(@Req() r:AuthRequest,@Query('companyId') companyId:string,@Query('kind') kind:string,@Query('value') value:string){return this.warehouse.scan(r.user,companyId,kind,value);}
 @Post('areas')@Permission('inventory.write')area(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.warehouse.area(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('racks')@Permission('inventory.write')rack(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.warehouse.rack(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('bins')@Permission('inventory.write')bin(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.warehouse.bin(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Patch('structure/:kind/:id')@Permission('inventory.write')change(@Req() r:AuthRequest,@Param('kind') kind:string,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.warehouse.change(r.user,kind,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('transfers')@Permission('inventory.write')transfer(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.warehouse.transfer(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('transfers/:id')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.warehouse.detail(r.user,id);}
 @Post('transfers/:id/reverse')@Permission('inventory.write')reverse(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.warehouse.reverse(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('bins/:id/labels')labels(@Req() r:AuthRequest,@Param('id') id:string){return this.warehouse.labels(r.user,id);}
 @Post('bins/:id/labels')@Permission('inventory.write')label(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.warehouse.label(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('bins/:id/labels/:labelId/download')async download(@Req() r:AuthRequest,@Res() res:Response,@Param('id') id:string,@Param('labelId') labelId:string){const file=await this.warehouse.downloadLabel(r.user,id,labelId,r.correlationId);res.set({'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+file.filename+'"','Cache-Control':'private, no-store','ETag':'"'+file.sha256+'"'}).send(file.content);}
}
