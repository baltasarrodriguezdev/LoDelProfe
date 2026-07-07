import {Router,Response} from'express';import{z}from'zod';import*as auth from'../services/auth.service.js';import{asyncHandler}from'../utils/async-handler.js';import{authenticate}from'../middlewares/auth.js';import{config}from'../config.js';
const r=Router(),s=z.object({firstName:z.string().min(2),lastName:z.string().min(2),phone:z.string().min(6),password:z.string().min(8)});
const cookieOptions={httpOnly:true,secure:config.production,sameSite:'lax' as const,path:'/',maxAge:config.authCookieMaxAgeMs};
const establish=(res:Response,result:{token:string;user:unknown},status=200)=>res.status(status).cookie(config.authCookieName,result.token,cookieOptions).json({user:result.user});
r.post('/register',asyncHandler(async(q,p)=>{establish(p,await auth.register(s.parse(q.body)),201)}));
r.post('/login',asyncHandler(async(q,p)=>{const d=z.object({phone:z.string(),password:z.string()}).parse(q.body);establish(p,await auth.login(d.phone,d.password))}));
r.post('/logout',(_q,p)=>p.clearCookie(config.authCookieName,{httpOnly:true,secure:config.production,sameSite:'lax',path:'/'}).status(204).end());
r.get('/me',authenticate,asyncHandler(async(q,p)=>p.json(await auth.me(q.auth!.userId))));export default r;