import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
const cleanPhone=(v:string)=>v.replace(/\D/g,'');
const publicUser=({passwordHash:_,...user}:any)=>user;
function session(user:{id:number;role:Role;passwordHash:string;[key:string]:unknown}){return{token:jwt.sign({userId:user.id,role:user.role},config.jwtSecret,{expiresIn:config.jwtExpiresIn as jwt.SignOptions['expiresIn']}),user:publicUser(user)}}
export async function register(data:{firstName:string;lastName:string;phone:string;password:string}){const phone=cleanPhone(data.phone);if(await prisma.user.findUnique({where:{phone}}))throw new HttpError(409,'Ese teléfono ya está registrado');const {password,...rest}=data;return session(await prisma.user.create({data:{...rest,phone,passwordHash:await bcrypt.hash(password,12)}}))}
export async function login(input:string,password:string){const user=await prisma.user.findUnique({where:{phone:cleanPhone(input)}});if(!user||!user.active||!await bcrypt.compare(password,user.passwordHash))throw new HttpError(401,'Teléfono o contraseña incorrectos');return session(user)}
export async function me(id:number){const user=await prisma.user.findUnique({where:{id}});if(!user)throw new HttpError(404,'Usuario no encontrado');return publicUser(user)}
