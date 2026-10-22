sap.ui.define(["netfusion/erp/controller/Base.controller"],function(Base){
  "use strict";
  return Base.extend("netfusion.erp.controller.Login",{
    onInit:function(){this.model({tenant:"netfusion",email:"",password:"",error:""});this.getOwnerComponent().getRouter().getRoute("login").attachPatternMatched(async function(){await this.getOwnerComponent().ready;if(this.state("/user"))this.route("home");}.bind(this));},
    onLogin:function(){this.run(async function(){var input=this.vm().getData();this.vm().setProperty("/error","");try{await this.getOwnerComponent().ready;var session=await this.api("/api/auth/session");this.getOwnerComponent().setSession(session);var data=await this.api("/api/auth/login",{method:"POST",body:{tenant:input.tenant,email:input.email,password:input.password}});this.vm().setProperty("/password","");this.getOwnerComponent().setSession(data);this.route("home");}catch(e){this.vm().setProperty("/error",e.message);}});}
  });
});
