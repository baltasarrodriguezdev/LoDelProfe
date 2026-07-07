import {Router,Response} from'express';import{z}from'zod';import*as auth from'../services/auth.service.js';import{asyncHandler}from'../utils/async-handler.js';import{authenticate}from'../middlewares/auth.js';import{config}from'../config.js';
const required=(field:string)=>({required_error:`Ingresá ${field}`,invalid_type_error:`Ingresá ${field}`});
const r=Router(),s=z.object({
  firstName:z.string(required('tu nombre')).trim().min(2,'El nombre debe tener al menos 2 caracteres'),
  lastName:z.string(required('tu apellido')).trim().min(2,'El apellido debe tener al menos 2 caracteres'),
  phone:z.string(required('tu teléfono')).regex(/^\+[1-9]\d{9,14}$/,'Ingresá el teléfono en formato internacional, por ejemplo +5493515551234'),
  password:z.string(required('una contraseña')).min(8,'La contraseña debe tener al menos 8 caracteres')
});
const cookieOptions={httpOnly:true,secure:config.production,sameSite:'lax' as const,path:'/',maxAge:config.authCookieMaxAgeMs};
const establish=(res:Response,result:{token:string;user:unknown},status=200)=>res.status(status).cookie(config.authCookieName,result.token,cookieOptions).json({user:result.user});
r.post('/register',asyncHandler(async(q,p)=>p.status(202).json(await auth.startRegistration(s.parse(q.body)))));
r.post('/register/verify',asyncHandler(async(q,p)=>{const d=z.object({phone:z.string(),code:z.string().regex(/^\d{4,10}$/,'Ingresá el código numérico recibido por SMS')}).parse(q.body);establish(p,await auth.completeRegistration(d.phone,d.code),201)}));
r.post('/login',asyncHandler(async(q,p)=>{const d=z.object({phone:z.string(required('tu teléfono')).min(1,'Ingresá tu teléfono'),password:z.string(required('tu contraseña')).min(1,'Ingresá tu contraseña')}).parse(q.body);establish(p,await auth.login(d.phone,d.password))}));
r.post('/logout',(_q,p)=>p.clearCookie(config.authCookieName,{httpOnly:true,secure:config.production,sameSite:'lax',path:'/'}).status(204).end());
r.get('/me',authenticate,asyncHandler(async(q,p)=>p.json(await auth.me(q.auth!.userId))));export default r;
