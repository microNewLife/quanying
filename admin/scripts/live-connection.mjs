import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
import pg from 'pg';
export const env=parseEnv(await fs.readFile(new URL('../.env',import.meta.url),'utf8'));
export const projectRef=new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const ca=await fs.readFile(new URL('./supabase-ca.crt',import.meta.url),'utf8');
if(projectRef!=='cwdortmihyhyqzlhicoa')throw new Error('项目与已核对的线上连接不符');
// Session endpoint copied from this project's Supabase Connect dialog on 2026-09-14.
export function connection(){return new pg.Client({host:'aws-1-ap-southeast-2.pooler.supabase.com',port:5432,database:'postgres',user:`postgres.${projectRef}`,password:env.SUPABASE_DB_PASSWORD || env.VITE_PASS_SUPABASE,ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:15000,query_timeout:30000});}
