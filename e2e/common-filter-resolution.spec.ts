import { expect, type Page } from '@playwright/test';
import { test, safeBody, type SafeDiagnostics } from './support/safe-diagnostics.ts';
import {
  assertAccepted, assertReady, assertWaiting, committedRoomSnapshot, createWaiting,
  createWaitingWithSession, observeCandidateRpcZero, ownParticipant, realtimeBarrier,
  startHost, withParticipants, type PublicApi, type RoomProjection,
} from './support/room-harness.ts';
import { assertFilterProgress, boundedFilterSnapshot, recoverOwnFilter,
  submitOwnFilter } from './support/filter-harness.ts';
import {
  assertResolutionTrafficZero, assertResolutionView, assertStoredResolution,
  installResolutionCommittedResponseLoss, installResolutionPreCommitFailure,
  observeResolutionTraffic,
} from './support/resolution-harness.ts';

const resolutionAnonymousBudget={I01:3,I02:4,I03:2} as const;

async function admit(diagnostics:SafeDiagnostics,api:PublicApi,room:RoomProjection,
  invitation:string,state:'waiting'|'ready',count:number,
  transport:Awaited<ReturnType<typeof realtimeBarrier>>){
  const readiness=transport.stats.readiness,reads=transport.stats.reads;
  observeResolutionTraffic(diagnostics.page);
  const joined=diagnostics.page.waitForResponse(response=>
    new URL(response.url()).pathname==='/rest/v1/rpc/join_room');
  expect((await diagnostics.page.goto(invitation))?.status()===200).toBe(true);
  await assertAccepted(await joined,room,'joined',{isCreator:false,isVoter:true},state,count);
  await transport.wait('readiness',readiness+1);await transport.wait('reads',reads+1);
  if(state==='waiting')await assertWaiting(diagnostics.page,diagnostics,{...room,voter_count:count});
  else await assertReady(diagnostics.page,diagnostics,room);
}

function unchangedFilters(room:RoomProjection,before:ReturnType<typeof boundedFilterSnapshot>){
  expect(JSON.stringify(boundedFilterSnapshot(room))===JSON.stringify(before)).toBe(true);
}

async function recoverLocked(pages:Page[],api:PublicApi,room:RoomProjection){
  for(const page of pages)expect((await recoverOwnFilter(page,api,room)).outcome==='locked').toBe(true);
}

test('@resolution I01 converges a three-voter compatible room across reload reconnect and re-entry',async({diagnostics,browser,baseURL,viewport},info)=>{
  test.setTimeout(120000);
  await safeBody(diagnostics,()=>withParticipants(browser,{baseURL,viewport},info,2,async([middle,last])=>{
    const group=[diagnostics,middle,last],pages=group.map(item=>item.page);
    pages.forEach(observeResolutionTraffic);
    const transports=await Promise.all(pages.map(page=>realtimeBarrier(page)));
    const transport=transports[1];
    try{
      const initialReadiness=transports[0].stats.readiness,initialReads=transports[0].stats.reads;
      const {api,room,invitation}=await createWaiting(diagnostics.page,diagnostics,
        {requiredVoterCount:3,creatorIsVoter:true});
      await transports[0].wait('readiness',initialReadiness+1);
      await transports[0].wait('reads',initialReads+1);
      for(const voter of [middle,last])await startHost(voter.page,voter);
      await admit(middle,api,room,invitation,'waiting',2,transports[1]);
      expect((await assertStoredResolution(diagnostics.page,api,room,'pending')).filter_completed_count===0).toBe(true);
      expect(pages.every(page=>observeResolutionTraffic(page).resolution()===0)).toBe(true);
      await admit(last,api,room,invitation,'ready',3,transports[2]);
      const inputs=[
        [pages[0],['action','comedy'],1990,2020],
        [pages[1],['drama'],2000,2026],
        [pages[2],[],1995,2010],
      ] as const;
      for(let index=0;index<inputs.length;index++){
        const [page,genres,from,to]=inputs[index];
        const result=await submitOwnFilter(page,api,room,genres,from,to);
        expect(result.outcome==='saved'&&result.filter_completed_count===index+1).toBe(true);
        if(index<2){
          expect((await assertStoredResolution(diagnostics.page,api,room,'pending')).filter_completed_count===index+1).toBe(true);
          expect(pages.every(item=>observeResolutionTraffic(item).resolution()===0)).toBe(true);
        }
      }
      for(const page of pages)await assertResolutionView(page,'compatible');
      const terminal=await assertStoredResolution(diagnostics.page,api,room,'compatible');
      expect(terminal.filter_completed_count===3).toBe(true);
      const frozen=boundedFilterSnapshot(room);
      expect(frozen.filters.length===3&&frozen.filters.some(filter=>filter.genres.length===0)&&
        frozen.filters.some(filter=>filter.genres.includes('action')&&filter.genres.includes('comedy'))&&
        frozen.filters.some(filter=>filter.genres.includes('drama'))).toBe(true);
      for(const item of group){await item.page.reload();await assertResolutionView(item.page,'compatible');}
      await recoverLocked(pages,api,room);
      const beforeReconnect=transport.stats.readiness;
      await transport.disconnect();
      await expect(middle.page.getByRole('button',{name:'Retry synchronization',exact:true})).toBeVisible();
      transport.resume();await middle.page.getByRole('button',{name:'Retry synchronization',exact:true}).click();
      await transport.wait('readiness',beforeReconnect+1);await assertResolutionView(middle.page,'compatible');
      for(const item of group){await item.page.goto('/');await item.page.goto(`/room/${room.code}`);
        await assertResolutionView(item.page,'compatible');}
      unchangedFilters(room,frozen);assertResolutionTrafficZero(pages);
      expect(committedRoomSnapshot(room).row.movie_candidate_id===null).toBe(true);
      expect(group.reduce((sum,item)=>sum+item.signupAttempts,0)===resolutionAnonymousBudget.I01).toBe(true);
      await diagnostics.record({scenario:'I01',outcome:'partial pending; Any plus two disjoint canonical OR selections and overlapping years; compatible convergence; reload/reconnect/re-entry; frozen filters; candidate/TMDB0; identities3'});
    }finally{await Promise.all(transports.map(item=>item.close()));}
  }));
});

test('@resolution I02 converges a non-voting creator and three voters on terminal incompatibility',async({diagnostics,browser,baseURL,viewport},info)=>{
  test.setTimeout(120000);
  await safeBody(diagnostics,()=>withParticipants(browser,{baseURL,viewport},info,3,async voters=>{
    const group=[diagnostics,...voters],pages=group.map(item=>item.page);
    pages.forEach(observeResolutionTraffic);
    const transports=await Promise.all(pages.map(page=>realtimeBarrier(page)));
    const transport=transports[0];
    try{
      const initialReadiness=transport.stats.readiness,initialReads=transport.stats.reads;
      const {api,room,invitation}=await createWaiting(diagnostics.page,diagnostics,
        {requiredVoterCount:3,creatorIsVoter:false});
      await transport.wait('readiness',initialReadiness+1);await transport.wait('reads',initialReads+1);
      for(const voter of voters)await startHost(voter.page,voter);
      await admit(voters[0],api,room,invitation,'waiting',1,transports[1]);
      await admit(voters[1],api,room,invitation,'waiting',2,transports[2]);
      await admit(voters[2],api,room,invitation,'ready',3,transports[3]);
      expect((await recoverOwnFilter(diagnostics.page,api,room)).outcome==='not_voter').toBe(true);
      await submitOwnFilter(voters[0].page,api,room,['action'],1900,1950);
      await submitOwnFilter(voters[1].page,api,room,['comedy'],2000,2010);
      expect((await assertStoredResolution(diagnostics.page,api,room,'pending')).filter_completed_count===2).toBe(true);
      const before=transport.stats.readiness;await transport.disconnect();
      await submitOwnFilter(voters[2].page,api,room,['drama'],2011,2026);
      for(const voter of voters)await assertResolutionView(voter.page,'incompatible');
      transport.resume();await diagnostics.page.getByRole('button',{name:'Retry synchronization',exact:true}).click();
      await transport.wait('readiness',before+1);await assertResolutionView(diagnostics.page,'incompatible');
      const terminal=await assertStoredResolution(diagnostics.page,api,room,'incompatible');
      expect(terminal.filter_completed_count===3).toBe(true);
      await expect(diagnostics.page.getByRole('checkbox')).toHaveCount(0);
      await expect(diagnostics.page.getByText(/Your filters:/)).toHaveCount(0);
      await expect(diagnostics.page.getByRole('link',{name:'Create a new room',exact:true})).toHaveAttribute('href','/');
      const frozen=boundedFilterSnapshot(room);expect(frozen.filters.length===3).toBe(true);
      for(const item of group){await item.page.reload();await assertResolutionView(item.page,'incompatible');}
      unchangedFilters(room,frozen);assertResolutionTrafficZero(pages);
      expect(committedRoomSnapshot(room).row.movie_candidate_id===null).toBe(true);
      expect(group.reduce((sum,item)=>sum+item.signupAttempts,0)===resolutionAnonymousBudget.I02).toBe(true);
      await diagnostics.record({scenario:'I02',outcome:'non-voting creator aggregate-only; three disjoint year inputs; missed update recovered on rebind; terminal incompatible/new-room action; frozen filters; candidate/TMDB0; identities4'});
    }finally{await Promise.all(transports.map(item=>item.close()));}
  }));
});

test('@resolution I03 recovers pre-commit failure and committed-response loss with two reused identities',async({diagnostics,browser,baseURL,viewport},info)=>{
  test.setTimeout(120000);
  await safeBody(diagnostics,()=>withParticipants(browser,{baseURL,viewport},info,1,async([voter])=>{
    const group=[diagnostics,voter],pages=group.map(item=>item.page);
    pages.forEach(observeResolutionTraffic);
    const transports=await Promise.all(pages.map(page=>realtimeBarrier(page)));
    try{
      const hostReadiness=transports[0].stats.readiness,hostReads=transports[0].stats.reads;
      const first=await createWaiting(diagnostics.page,diagnostics,{requiredVoterCount:2,creatorIsVoter:true});
      await transports[0].wait('readiness',hostReadiness+1);await transports[0].wait('reads',hostReads+1);
      await startHost(voter.page,voter);
      await admit(voter,first.api,first.room,first.invitation,'ready',2,transports[1]);
      await submitOwnFilter(diagnostics.page,first.api,first.room,['action'],1900,2020);
      const aborts=await Promise.all(pages.map(installResolutionPreCommitFailure));
      await submitOwnFilter(voter.page,first.api,first.room,['comedy'],2000,2026);
      for(const page of pages)await assertResolutionView(page,'error');
      expect(aborts.every(control=>control.calls()===1)).toBe(true);
      await Promise.all(aborts.map(control=>control.close()));
      expect((await assertStoredResolution(diagnostics.page,first.api,first.room,'pending')).filter_completed_count===2).toBe(true);
      await diagnostics.page.getByRole('button',{name:'Retry common-filter resolution',exact:true}).click();
      for(const page of pages)await assertResolutionView(page,'compatible');
      const firstFrozen=boundedFilterSnapshot(first.room);

      const nextReadiness=transports[0].stats.readiness,nextReads=transports[0].stats.reads;
      const next=await createWaitingWithSession(diagnostics.page,diagnostics,first.api,
        committedRoomSnapshot(first.room),{requiredVoterCount:2,creatorIsVoter:true});
      await transports[0].wait('readiness',nextReadiness+1);await transports[0].wait('reads',nextReads+1);
      await admit(voter,first.api,next.room,next.invitation,'ready',2,transports[1]);
      await submitOwnFilter(diagnostics.page,first.api,next.room,['drama'],1990,2010);
      const lost=await installResolutionCommittedResponseLoss(diagnostics.page);
      const peerAbort=await installResolutionPreCommitFailure(voter.page);
      await submitOwnFilter(voter.page,first.api,next.room,[],2000,2020);
      await expect.poll(()=>lost.calls()+peerAbort.calls()).toBe(2);
      await lost.close();await peerAbort.close();
      expect(lost.result()?.outcome==='compatible'&&peerAbort.calls()===1).toBe(true);
      await diagnostics.page.reload();
      for(const page of pages)await assertResolutionView(page,'compatible');
      expect((await assertStoredResolution(diagnostics.page,first.api,next.room,'compatible')).filter_completed_count===2).toBe(true);
      unchangedFilters(first.room,firstFrozen);expect(boundedFilterSnapshot(next.room).filters.length===2).toBe(true);
      assertResolutionTrafficZero(pages);
      for(const room of [first.room,next.room])expect(committedRoomSnapshot(room).row.movie_candidate_id===null).toBe(true);
      expect(group.reduce((sum,item)=>sum+item.signupAttempts,0)===resolutionAnonymousBudget.I03).toBe(true);
      await diagnostics.record({scenario:'I03',outcome:'two identities reused across two rooms; pre-forward resolution failure pending then explicit Retry; committed compatible response discarded then stored-status reload recovery; frozen filters; candidate/TMDB0; identities2'});
    }finally{await Promise.all(transports.map(item=>item.close()));}
  }));
});
