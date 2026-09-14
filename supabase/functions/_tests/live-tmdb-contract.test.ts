import { assertEquals } from './assert.ts';
import { TMDB_GENRE_IDS } from '../_shared/tmdb-eligibility.ts';

const token=Deno.env.get('TMDB_API_READ_ACCESS_TOKEN');
const base='https://api.themoviedb.org/3';

async function read(path:string,headers:HeadersInit):Promise<unknown>{
  const response=await fetch(`${base}${path}`,{headers});
  if(!response.ok)throw new Error('TMDB_CONTRACT_HTTP_FAILURE');
  return await response.json();
}

Deno.test({name:'live official TMDB v3 read contract remains compatible',ignore:!token,fn:async()=>{
  if(!token)throw new Error('TMDB_CONTRACT_CONFIGURATION_REQUIRED');
  const headers={authorization:`Bearer ${token}`,accept:'application/json'};
  const genres=await read('/genre/movie/list?language=en-US',headers) as Record<string,unknown>;
  if(!Array.isArray(genres.genres))throw new Error('TMDB_CONTRACT_GENRES_DRIFT');
  const ids=new Set(genres.genres.flatMap(value=>value&&typeof value==='object'&&
    Number.isInteger((value as Record<string,unknown>).id)?[(value as Record<string,unknown>).id as number]:[]));
  assertEquals(Object.values(TMDB_GENRE_IDS).every(id=>ids.has(id)),true);

  const parameters=new URLSearchParams({language:'en-US',include_adult:'false',include_video:'false',
    sort_by:'primary_release_date.asc','primary_release_date.gte':'2000-01-01',
    'primary_release_date.lte':'2000-01-31',page:'1'});
  const discover=await read(`/discover/movie?${parameters}`,headers) as Record<string,unknown>;
  if(discover.page!==1||!Number.isInteger(discover.total_pages)||!Number.isInteger(discover.total_results)||
      !Array.isArray(discover.results)||discover.results.length===0)throw new Error('TMDB_CONTRACT_DISCOVER_DRIFT');
  const movie=discover.results.find(value=>value&&typeof value==='object'&&
    Number.isInteger((value as Record<string,unknown>).id)&&
    (value as Record<string,unknown>).adult===false) as Record<string,unknown>|undefined;
  if(!movie)throw new Error('TMDB_CONTRACT_DISCOVER_DRIFT');
  const details=await read(`/movie/${movie.id}?language=en-US`,headers) as Record<string,unknown>;
  if(details.id!==movie.id||typeof details.title!=='string'||!details.title.trim()||
      typeof details.release_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(details.release_date))
    throw new Error('TMDB_CONTRACT_DETAILS_DRIFT');
  const configuration=await read('/configuration',headers) as Record<string,any>;
  if(!configuration.images||typeof configuration.images.secure_base_url!=='string'||
      !configuration.images.secure_base_url.startsWith('https://')||
      !Array.isArray(configuration.images.poster_sizes)||
      !configuration.images.poster_sizes.some((size:unknown)=>typeof size==='string'&&/^w\d+$/.test(size)))
    throw new Error('TMDB_CONTRACT_CONFIGURATION_DRIFT');
}});
