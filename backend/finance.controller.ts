import { Controller,Get,Post,Param,Body,Req,UseGuards } from '@nestjs/common';
import { AuthRequest,SessionGuard,csrf } from './auth';
import { Permission } from './permissions';
import { Finance } from './finance';
@Controller('api/finance')@UseGuards(SessionGuard)@Permission('finance.read')
export class FinanceController {
 constructor(private finance:Finance){}
 @Get('companies')companies(@Req() r:AuthRequest){return this.finance.companies(r.user);}
 @Post('companies')@Permission('finance.write')company(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.finance.company(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('companies/:id/context')context(@Req() r:AuthRequest,@Param('id') id:string){return this.finance.context(r.user,id);}
 @Post('companies/:id/accounts')@Permission('finance.write')account(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.finance.account(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('companies/:id/periods')@Permission('finance.write')period(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.finance.period(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('companies/:id/periods/:period/status')@Permission('finance.write')periodStatus(@Req() r:AuthRequest,@Param('id') id:string,@Param('period') period:string,@Body() b:unknown){csrf(r);return this.finance.periodStatus(r.user,id,period,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('companies/:id/rules')@Permission('finance.write')rules(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.finance.rules(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('companies/:id/journals')journals(@Req() r:AuthRequest,@Param('id') id:string){return this.finance.journals(r.user,id);}
 @Get('companies/:id/trial-balance')trial(@Req() r:AuthRequest,@Param('id') id:string){return this.finance.trialBalance(r.user,id);}
 @Post('journals')@Permission('finance.write')create(@Req() r:AuthRequest,@Body() b:unknown){csrf(r);return this.finance.create(r.user,b,r.get('Idempotency-Key'),r.correlationId);}
 @Get('journals/:id')detail(@Req() r:AuthRequest,@Param('id') id:string){return this.finance.detail(r.user,id);}
 @Post('journals/:id/post')@Permission('finance.write')post(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.finance.post(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
 @Post('journals/:id/reverse')@Permission('finance.write')reverse(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){csrf(r);return this.finance.reverse(r.user,id,b,r.get('Idempotency-Key'),r.correlationId);}
}
