import { DateTime } from 'luxon';
import { config } from '../config.js';
import { HttpError } from './http-error.js';
export const localDateTime=(date:string,time:string)=>{const value=DateTime.fromISO(`${date}T${time}`,{zone:config.timezone});if(!value.isValid)throw new HttpError(400,'Fecha u hora inválida');return value};
export const dayOfWeek=(date:string)=>DateTime.fromISO(date,{zone:config.timezone}).weekday%7;
export const bounds=(date:string,openTime:string,closeTime:string)=>{const open=localDateTime(date,openTime);let close=localDateTime(date,closeTime);if(close<=open)close=close.plus({days:1});return{open,close}};

export type BusinessInterval={open:DateTime;close:DateTime};
export const businessIntervals=(date:string,openTime:string,closeTime:string):BusinessInterval[]=>{
  if(dayOfWeek(date)===4&&openTime==='09:00'&&closeTime==='00:00'){
    return[
      {open:localDateTime(date,'09:00'),close:localDateTime(date,'13:00')},
      bounds(date,'15:00','00:00')
    ];
  }
  return[bounds(date,openTime,closeTime)];
};

