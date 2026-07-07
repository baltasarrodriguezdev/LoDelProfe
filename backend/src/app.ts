import express from'express';import cors from'cors';import{config}from'./config.js';import auth from'./routes/auth.routes.js';import pub from'./routes/public.routes.js';import bookings from'./routes/booking.routes.js';import admin from'./routes/admin.routes.js';import dashboard from'./routes/dashboard.routes.js';import{errorHandler,notFound}from'./middlewares/error.js';import{HttpError}from'./utils/http-error.js';
export const app=express();
app.use(cors({origin:config.frontendUrls,credentials:true}),express.json());
app.use((req,_res,next)=>{const unsafe=!['GET','HEAD','OPTIONS'].includes(req.method),origin=req.headers.origin;if(unsafe&&origin&&!config.frontendUrls.includes(origin))return next(new HttpError(403,'Origen no autorizado'));next()});
const routes=express.Router();
routes.get('/health',(_,p)=>p.json({status:'ok'}));routes.use('/auth',auth);routes.use(pub);routes.use('/bookings',bookings);routes.use('/admin',dashboard);routes.use('/admin',admin);
app.use('/api',routes);app.use(routes);app.use(notFound);app.use(errorHandler);
export default app;
