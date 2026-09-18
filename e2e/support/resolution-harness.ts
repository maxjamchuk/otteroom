import { expect, type Page, type Request, type Route } from '@playwright/test';
import { committedRoomSnapshot, observeCandidateRpcZero, ownRooms,
  type PublicApi, type RoomProjection } from './room-harness.ts';
import { filterResolutionBoundaryDiagnostic,
  type FilterResolutionBoundaryDiagnostic } from './harness-observability.ts';
import type { SafeDiagnostics } from './safe-diagnostics.ts';

export type ResolutionStatus = RoomProjection['filter_resolution_status'];
export type ResolutionResult = {
  outcome: 'not_found' | 'pending' | 'compatible' | 'incompatible';
  filter_resolution_status: ResolutionStatus | null;
};

const traffic = new WeakMap<Page,{ resolution:number; tmdb:number; listener:(request:Request)=>void }>();

export function observeResolutionTraffic(page:Page){
  let entry=traffic.get(page);
  if(!entry){
    entry={resolution:0,tmdb:0,listener:request=>{
      const url=new URL(request.url());
      if(url.pathname==='/rest/v1/rpc/resolve_common_filters')entry!.resolution++;
      if(/(?:^|\.)themoviedb\.org$/i.test(url.hostname)||/\/tmdb(?:\/|$)/i.test(url.pathname))entry!.tmdb++;
    }};
    traffic.set(page,entry);page.on('request',entry.listener);
  }
  return {resolution:()=>entry!.resolution,tmdb:()=>entry!.tmdb};
}

export function validateResolutionResult(value:unknown):ResolutionResult{
  if(!Array.isArray(value)||value.length!==1||!value[0]||typeof value[0]!=='object'||
      Array.isArray(value[0])||Object.keys(value[0]).sort().join(',')!==
        'filter_resolution_status,outcome')throw new Error('E2E_SAFE_FAILURE');
  const row=value[0] as ResolutionResult;
  if(!(row.outcome==='not_found'&&row.filter_resolution_status===null||
      row.outcome==='pending'&&row.filter_resolution_status==='pending'||
      row.outcome==='compatible'&&row.filter_resolution_status==='compatible'||
      row.outcome==='incompatible'&&row.filter_resolution_status==='incompatible')){
    throw new Error('E2E_SAFE_FAILURE');
  }
  return row;
}

export async function resolveCommonFilters(page:Page,api:PublicApi,room:RoomProjection){
  const rows:unknown=await page.evaluate(async({origin,publicKey,roomId})=>{
    const key=Object.keys(localStorage).find(item=>/^sb-.+-auth-token$/.test(item));
    const session=key?JSON.parse(localStorage.getItem(key)??'null'):null;
    if(!session?.access_token)throw new Error('E2E_SAFE_FAILURE');
    const response=await fetch(`${origin}/rest/v1/rpc/resolve_common_filters`,{method:'POST',
      headers:{apikey:publicKey,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_room_id:roomId})});
    if(!response.ok)throw new Error('E2E_SAFE_FAILURE');
    return response.json();
  },{...api,roomId:room.id});
  return validateResolutionResult(rows);
}

export async function assertStoredResolution(page:Page,api:PublicApi,room:RoomProjection,
  expected:ResolutionStatus){
  const rows=await ownRooms(page,api,room.id);
  expect(rows.length===1&&rows[0].filter_resolution_status===expected).toBe(true);
  return rows[0];
}

export async function assertResolutionView(page:Page,status:ResolutionStatus|'resolving'|'error'|'integrity-error'){
  if(status==='resolving'){
    await expect(page.getByRole('heading',{name:'Resolving common filters…',exact:true})).toBeVisible();
  }else if(status==='error'){
    await expect(page.getByText('Unable to resolve common filters. Please try again.',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Retry common-filter resolution',exact:true})).toBeVisible();
    await expect(page.getByText('Filters are incompatible.',{exact:true})).toHaveCount(0);
  }else if(status==='compatible'){
    await expect(page.getByRole('heading',{name:'Filters are compatible.',exact:true})).toBeVisible();
    await expect(page.getByText('Movie candidate sourcing is the next step in a future feature.',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Retry common-filter resolution',exact:true})).toHaveCount(0);
  }else if(status==='incompatible'){
    await expect(page.getByRole('heading',{name:'Filters are incompatible.',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'Create a new room',exact:true})).toHaveAttribute('href','/');
    await expect(page.getByRole('button',{name:'Save filters',exact:true})).toHaveCount(0);
  }else{
    await expect(page.getByRole('heading',{name:'Common-filter status could not be verified.',exact:true})).toBeVisible();
    await expect(page.getByText('Filters are compatible.',{exact:true})).toHaveCount(0);
    await expect(page.getByText('Filters are incompatible.',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('link',{name:'Create a new room',exact:true})).toHaveCount(0);
  }
  if(status!=='compatible'){
    await expect(page.getByTestId('candidate-card')).toHaveCount(0);
    expect(observeCandidateRpcZero(page).count()).toBe(0);
  }
  expect(observeResolutionTraffic(page).tmdb()).toBe(0);
}

// H02's direct filter RPCs return when their own transactions commit. Feature
// 005 resolution is a separate client-driven transaction after the room UPDATE
// is refetched. Observe that native path without routing or replacing it, then
// use the terminal browser view plus authoritative snapshot as the boundary.
export function observeFilterResolutionBoundary(pages:Page[],room:RoomProjection,
  expectedResolution:'compatible'|'incompatible',
  operationPhase:FilterResolutionBoundaryDiagnostic['operationPhase'],
  diagnostics?:Pick<SafeDiagnostics,'recordHarnessDiagnostic'>){
  if(pages.length<2||pages.length>4||new Set(pages).size!==pages.length||
      !/^[0-9a-f-]{36}$/.test(room.id))throw new Error('E2E_SAFE_FAILURE');
  const tracked=new WeakSet<Request>();
  let requests=0,responses=0,successfulResponses=0,requestFailures=0,disposed=false;
  const entries=pages.map(page=>{
    const onRequest=(request:Request)=>{
      if(disposed||new URL(request.url()).pathname!=='/rest/v1/rpc/resolve_common_filters')return;
      try{
        const body=request.postDataJSON();
        if(request.method()==='POST'&&Object.keys(body??{}).join(',')==='p_room_id'&&
            body.p_room_id===room.id){tracked.add(request);requests++;}
      }catch{/* A malformed request is owned by the existing resolution contract checks. */}
    };
    const onResponse=(response:import('@playwright/test').Response)=>{
      if(disposed||!tracked.has(response.request()))return;
      responses++;if(response.ok())successfulResponses++;
    };
    const onFailed=(request:Request)=>{if(!disposed&&tracked.has(request))requestFailures++;};
    page.on('request',onRequest);page.on('response',onResponse);page.on('requestfailed',onFailed);
    return{page,onRequest,onResponse,onFailed};
  });
  const diagnostic=(terminalViewObserved:boolean)=>{
    const stored=committedRoomSnapshot(room);
    return filterResolutionBoundaryDiagnostic({operationPhase,
      expectedFilterCount:room.required_voter_count,
      authoritativeFilterCount:stored.row.filter_completed_count,
      expectedResolution,filterResolution:stored.row.filter_resolution_status,
      terminalViewObserved,resolverRequestsObserved:requests,
      resolverResponsesObserved:responses,resolverSuccessResponses:successfulResponses,
      resolverRequestFailures:requestFailures});
  };
  return{
    async wait(page:Page){
      let terminalViewObserved=false;
      try{
        await assertResolutionView(page,expectedResolution);terminalViewObserved=true;
        const state=diagnostic(terminalViewObserved);
        if(state.missing.length)throw new Error('E2E_SAFE_FAILURE');
        return state;
      }catch(error){diagnostics?.recordHarnessDiagnostic(diagnostic(terminalViewObserved));throw error;}
    },
    close(){
      if(disposed)return;disposed=true;
      for(const entry of entries){entry.page.removeListener('request',entry.onRequest);
        entry.page.removeListener('response',entry.onResponse);
        entry.page.removeListener('requestfailed',entry.onFailed);}
    },
  };
}

export async function installResolutionPreCommitFailure(page:Page){
  let calls=0;
  const handler=async(route:Route)=>{calls++;await route.abort('failed');};
  await page.route('**/rest/v1/rpc/resolve_common_filters',handler,{times:1});
  return {calls:()=>calls,close:()=>page.unroute('**/rest/v1/rpc/resolve_common_filters',handler)};
}

export async function installResolutionCommittedResponseLoss(page:Page){
  let calls=0,result:ResolutionResult|null=null;
  const handler=async(route:Route)=>{
    calls++;
    const response=await route.fetch({maxRetries:0,maxRedirects:0,timeout:15000});
    try{if(!response.ok())throw new Error('E2E_SAFE_FAILURE');result=validateResolutionResult(await response.json());}
    finally{await response.dispose();}
    await route.abort('failed');
  };
  await page.route('**/rest/v1/rpc/resolve_common_filters',handler,{times:1});
  return {calls:()=>calls,result:()=>result,
    close:()=>page.unroute('**/rest/v1/rpc/resolve_common_filters',handler)};
}

export function assertResolutionTrafficZero(pages:Page[]){
  expect(pages.every(page=>observeCandidateRpcZero(page).count()===0&&
    observeResolutionTraffic(page).tmdb()===0)).toBe(true);
}
