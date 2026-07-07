import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
const cookieValue=(header:string|undefined,name:string)=>header?.split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='))?.slice(name.length+1);
export const authenticate:RequestHandler=(req,_res,next)=>{const token=cookieValue(req.headers.cookie,config.authCookieName)??req.headers.authorization?.replace(/^Bearer\s+/i,'');if(!token)return next(new HttpError(401,'Se requiere autenticación'));try{req.auth=jwt.verify(token,config.jwtSecret) as {userId:number;role:Role};next()}catch{next(new HttpError(401,'Token inválido o vencido'))}};
export const authorize=(...roles:Role[]):RequestHandler=>(req,_res,next)=>req.auth&&roles.includes(req.auth.role)?next():next(new HttpError(403,'No tenés permisos para esta acción'));
