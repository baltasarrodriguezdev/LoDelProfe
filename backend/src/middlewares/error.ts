import type { ErrorRequestHandler,RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';
import { Prisma } from '@prisma/client';
export const notFound:RequestHandler=(_req,_res,next)=>next(new HttpError(404,'Ruta no encontrada'));
export const errorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{if(error instanceof ZodError){res.status(400).json({message:'Datos inválidos',errors:error.flatten().fieldErrors});return}if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'){res.status(409).json({message:'Estos datos ya están registrados. Actualizá la página e intentá nuevamente.'});return}const status=error instanceof HttpError?error.status:500;if(status===500)console.error(error);res.status(status).json({message:error instanceof HttpError?error.message:'Ocurrió un error interno. Intentá nuevamente.',...(error instanceof HttpError&&error.code?{code:error.code}:{})})};
