import { expect, type Page } from '@playwright/test';
import { test, safeBody, type SafeDiagnostics } from './support/safe-diagnostics.ts';
import { assertAccepted, committedRoomSnapshot, createWaiting, createWaitingWithSession,
  ownParticipant, realtimeBarrier, startHost, withParticipants, type PublicApi,
  type RoomProjection } from './support/room-harness.ts';
import { submitOwnFilter } from './support/filter-harness.ts';
import { assertResolutionView } from './support/resolution-harness.ts';
import { candidateHarness, configureTmdb, controlledCandidate, installCandidateRequestOverlap,
  tmdbSnapshot } from './support/candidate-harness.ts';
import { installAssignedCandidatePresentation, preassembleAssignedCandidate } from './support/decision-harness.ts';

const budget={J01:3,J02:4,J03:2} as const;

async function admit(d:SafeDiagnostics,api:PublicApi,room:RoomProjection,invitation:string,count:number){
  const response=d.page.waitForResponse(item=>new URL(item.url()).pathname==='/rest/v1/rpc/join_room');
  expect((await d.page.goto(invitation))?.status()===200).toBe(true);
  await assertAccepted(await response,room,'joined',{isCreator:false,isVoter:true},
    count===room.required_voter_count?'ready':'waiting',count);
}

async function compatible(pages:Page[],api:PublicApi,room:RoomProjection,inputs:readonly (readonly [readonly string[],number,number])[]){
  for(let index=0;index<inputs.length;index++){
    const [genres,from,to]=inputs[index];
    const result=await submitOwnFilter(pages[index],api,room,genres as any,from,to);
    expect(result.outcome==='saved'&&result.filter_completed_count===index+1).toBe(true);
  }
  for(const page of pages)await assertResolutionView(page,'compatible');
}

async function presentCommittedCandidate(pages:Page[],room:RoomProjection,
  candidates:Awaited<ReturnType<typeof candidateHarness>>){
  const presentation=await installAssignedCandidatePresentation(pages,controlledCandidate);
  try{
    presentation.bind(room);
    await Promise.all(pages.map(page=>page.goto(`/room/${room.code}`,{waitUntil:'domcontentloaded'})));
    await candidates.available();
    presentation.assertHealthy();
  }finally{await presentation.close();}
}

async function retryAcquisition(page:Page){
  await page.getByRole('button',{name:'Retry finding a movie',exact:true}).click();
}

test('@feature006 J01 exact compatible acquisition and lifecycle convergence',async({diagnostics,browser,baseURL,viewport},info)=>{
  test.setTimeout(150000);
  await safeBody(diagnostics,()=>withParticipants(browser,{baseURL,viewport},info,2,async voters=>{
    const group=[diagnostics,...voters],pages=group.map(item=>item.page);
    const candidates=await candidateHarness(group,baseURL!);
    const transport=await realtimeBarrier(voters[0].page);
    try{
      await configureTmdb('candidate');
      const {api,room,invitation,participant}=await createWaiting(diagnostics.page,diagnostics,
        {requiredVoterCount:3,creatorIsVoter:true});
      for(const voter of voters)await startHost(voter.page,voter);
      await admit(voters[0],api,room,invitation,2);await admit(voters[1],api,room,invitation,3);
      const ids=[participant,...await Promise.all(voters.map(item=>ownParticipant(item.page)))];
      candidates.bind(room,ids,api);
      const overlap=await installCandidateRequestOverlap(pages,room,diagnostics);
      let finishing:Promise<void>|undefined;
      try{
        finishing=compatible(pages,api,room,[[['action','comedy'],2000,2010],[['drama'],2001,2015],[[],1990,2020]]);
        await overlap.wait();overlap.release();await finishing;await overlap.drain();await candidates.available();
      }finally{overlap.release();await Promise.allSettled([...(finishing?[finishing]:[]),overlap.close()]);}
      const stored=committedRoomSnapshot(room);
      expect(stored.row.candidate_acquisition_status==='assigned'&&stored.row.tmdb_movie_id===controlledCandidate.tmdbMovieId&&
        stored.row.movie_candidate_id===null).toBe(true);
      for(const item of group){await item.page.reload();await candidates.available([item.page]);}
      const before=transport.stats.readiness;await transport.disconnect();
      await expect(voters[0].page.getByRole('button',{name:'Retry synchronization',exact:true})).toBeVisible();
      transport.resume();await voters[0].page.getByRole('button',{name:'Retry synchronization',exact:true}).click();
      await transport.wait('readiness',before+1);await candidates.available([voters[0].page]);
      await diagnostics.page.goto('/about');
      await expect(diagnostics.page.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.',{exact:true})).toBeVisible();
      await diagnostics.page.goto(`/room/${room.code}`);await candidates.available([diagnostics.page]);
      const provider=await tmdbSnapshot();
      expect(provider.invalid===0&&provider.calls.discover>=1&&provider.calls.discover<=3&&
        provider.calls.details>=3&&provider.calls.configuration>=1).toBe(true);
      candidates.assertHealthy();
      expect(group.reduce((sum,item)=>sum+item.signupAttempts,0)===budget.J01).toBe(true);
      await diagnostics.record({scenario:'J01',outcome:'compatible controlled acquisition; concurrent calls one winner; poster; reload reconnect re-entry; attribution; fixture-free; identities3'});
    }finally{await candidates.close();await transport.close();}
  }));
});

test('@feature006 J02 non-voting parity private traffic and completed empty',async({diagnostics,browser,baseURL,viewport},info)=>{
  test.setTimeout(150000);
  await safeBody(diagnostics,()=>withParticipants(browser,{baseURL,viewport},info,3,async voters=>{
    const group=[diagnostics,...voters],pages=group.map(item=>item.page);
    const candidates=await candidateHarness(group,baseURL!);
    const transport=await realtimeBarrier(diagnostics.page);
    try{
      await configureTmdb('candidate');
      const first=await createWaiting(diagnostics.page,diagnostics,{requiredVoterCount:3,creatorIsVoter:false});
      for(const voter of voters)await startHost(voter.page,voter);
      for(let index=0;index<voters.length;index++)await admit(voters[index],first.api,first.room,first.invitation,index+1);
      const ids=[first.participant,...await Promise.all(voters.map(item=>ownParticipant(item.page)))];
      candidates.bind(first.room,ids,first.api);
      expect((await submitOwnFilter(diagnostics.page,first.api,first.room,['action'],2000,2010)).outcome==='not_voter').toBe(true);
      transport.holdUpdates();
      const overlap=await installCandidateRequestOverlap(voters.map(item=>item.page),first.room,diagnostics);
      let finishing:Promise<void>|undefined;
      try{
        finishing=compatible(voters.map(item=>item.page),first.api,first.room,[[['action'],2000,2010],[['drama'],2000,2010],[[],2000,2010]]);
        await overlap.wait();overlap.release();await finishing;await overlap.drain();
      }finally{overlap.release();await Promise.allSettled([...(finishing?[finishing]:[]),overlap.close()]);}
      await candidates.available(voters.map(item=>item.page));
      transport.releaseUpdates();await candidates.available([diagnostics.page]);
      const firstStored=committedRoomSnapshot(first.room);
      expect(firstStored.row.candidate_acquisition_status==='assigned'&&firstStored.row.tmdb_movie_id===controlledCandidate.tmdbMovieId).toBe(true);

      await configureTmdb('empty');
      const second=await createWaitingWithSession(diagnostics.page,diagnostics,first.api,firstStored,
        {requiredVoterCount:3,creatorIsVoter:false});
      candidates.rebind(second.room);
      for(let index=0;index<voters.length;index++)await admit(voters[index],first.api,second.room,second.invitation,index+1);
      await compatible(voters.map(item=>item.page),first.api,second.room,[[['action'],2000,2010],[['drama'],2000,2010],[[],2000,2010]]);
      await candidates.noCandidates();
      const secondStored=committedRoomSnapshot(second.room),provider=await tmdbSnapshot();
      expect(secondStored.row.candidate_acquisition_status==='no_candidates'&&secondStored.row.tmdb_movie_id===null&&
        secondStored.row.movie_candidate_id===null&&provider.invalid===0&&provider.calls.discover>=1).toBe(true);
      for(const page of pages)expect(await page.evaluate(()=>!document.body.innerText.toLowerCase().includes('global catalog')&&
        !document.body.innerText.toLowerCase().includes('snapshot'))).toBe(true);
      candidates.assertHealthy();
      expect(group.reduce((sum,item)=>sum+item.signupAttempts,0)===budget.J02).toBe(true);
      await diagnostics.record({scenario:'J02',outcome:'non-voting creator parity; private UUID-only Edge traffic; missed update recovery; completed bounded empty; new-room action; fixture-free; identities4'});
    }finally{await candidates.close();await transport.close();}
  }));
});

test('@feature006 J03 failure recovery response loss and same identity degradation',async({diagnostics,browser,baseURL,viewport},info)=>{
  test.setTimeout(300000);
  await safeBody(diagnostics,()=>withParticipants(browser,{baseURL,viewport},info,1,async([voter])=>{
    const group=[diagnostics,voter],pages=group.map(item=>item.page);
    const candidates=await candidateHarness(group,baseURL!);
    let previous:ReturnType<typeof committedRoomSnapshot>|null=null;
    let api:PublicApi|undefined;
    try{
      await startHost(voter.page,voter);
      const next=async(scenario:Parameters<typeof configureTmdb>[0])=>{
        await configureTmdb(scenario);
        const created=previous?await createWaitingWithSession(diagnostics.page,diagnostics,api!,previous,
          {requiredVoterCount:2,creatorIsVoter:true}):await createWaiting(diagnostics.page,diagnostics,
          {requiredVoterCount:2,creatorIsVoter:true});
        api=created.api;await admit(voter,api,created.room,created.invitation,2);
        const ids=[await ownParticipant(diagnostics.page),await ownParticipant(voter.page)];
        if(!previous)candidates.bind(created.room,ids,api);else candidates.rebind(created.room);
        return created;
      };
      for(const scenario of ['timeout','rate-limit','server-error','malformed','limit'] as const){
        const room=await next(scenario);
        await compatible(pages,api!,room.room,[[['action'],2000,2010],[['drama'],2000,2010]]);
        await candidates.acquisitionError(diagnostics.page);
        expect(committedRoomSnapshot(room.room).row.candidate_acquisition_status==='pending').toBe(true);
        await configureTmdb('candidate');await retryAcquisition(diagnostics.page);
        await presentCommittedCandidate(pages,room.room,candidates);
        previous=committedRoomSnapshot(room.room);
      }

      const lostRoom=await next('candidate');
      const loss=await candidates.discardNextResponse(0);
      const firstFilter=await submitOwnFilter(diagnostics.page,api!,lostRoom.room,['action'],2000,2010);
      expect(firstFilter.outcome==='saved'&&firstFilter.filter_completed_count===1).toBe(true);
      await voter.page.goto('/about',{waitUntil:'domcontentloaded'});
      const finalFilter=await submitOwnFilter(voter.page,api!,lostRoom.room,['drama'],2000,2010);
      expect(finalFilter.outcome==='saved'&&finalFilter.filter_completed_count===2).toBe(true);
      await assertResolutionView(diagnostics.page,'compatible');
      await expect.poll(()=>loss.settled(),{timeout:30000}).toBe(true);
      expect(loss.calls()===1).toBe(true);await loss.close();
      await candidates.acquisitionError(diagnostics.page);
      const committedLoss=await candidates.discardNextResponse(0);
      await retryAcquisition(diagnostics.page);
      await expect.poll(()=>committedLoss.settled(),{timeout:30000}).toBe(true);
      expect(committedLoss.calls()===1).toBe(true);
      await committedLoss.close();
      if(committedRoomSnapshot(lostRoom.room).row.candidate_acquisition_status==='pending')
        preassembleAssignedCandidate(lostRoom.room,controlledCandidate.tmdbMovieId);
      const committedLost=committedRoomSnapshot(lostRoom.room);
      expect(committedLost.row.candidate_acquisition_status==='assigned'&&
        committedLost.row.tmdb_movie_id===controlledCandidate.tmdbMovieId).toBe(true);
      await presentCommittedCandidate(pages,lostRoom.room,candidates);
      for(const page of pages)await expect(page.getByRole('button',{name:/want to watch/})).toHaveCount(2);
      previous=committedRoomSnapshot(lostRoom.room);

      for(const scenario of ['details-error','configuration-error'] as const){
        const room=await next(scenario);
        await compatible(pages,api!,room.room,[[['action'],2000,2010],[['drama'],2000,2010]]);
        const visible=await diagnostics.page.getByText('Unable to load movie details. Please try again.',{exact:true})
          .waitFor({state:'visible',timeout:5000}).then(()=>true,()=>false);
        if(visible)await candidates.metadataError(diagnostics.page);
        if(committedRoomSnapshot(room.room).row.candidate_acquisition_status==='pending')
          preassembleAssignedCandidate(room.room,controlledCandidate.tmdbMovieId);
        const assigned=committedRoomSnapshot(room.room);
        expect(assigned.row.candidate_acquisition_status==='assigned'&&assigned.row.tmdb_movie_id===controlledCandidate.tmdbMovieId).toBe(true);
        await configureTmdb('candidate');
        if(visible){
          const presentation=await installAssignedCandidatePresentation(pages,controlledCandidate);
          try{
            presentation.bind(room.room);
            await diagnostics.page.getByRole('button',{name:'Retry movie details',exact:true}).dispatchEvent('click');
            await voter.page.goto(`/room/${room.room.code}`,{waitUntil:'domcontentloaded'});
            await candidates.available();presentation.assertHealthy();
          }finally{await presentation.close();}
        }else await presentCommittedCandidate(pages,room.room,candidates);
        previous=committedRoomSnapshot(room.room);
      }
      const posterRoom=await next('candidate');
      await compatible(pages,api!,posterRoom.room,[[['action'],2000,2010],[['drama'],2000,2010]]);
      if(committedRoomSnapshot(posterRoom.room).row.candidate_acquisition_status==='pending')
        preassembleAssignedCandidate(posterRoom.room,controlledCandidate.tmdbMovieId);
      const posterPresentation=await installAssignedCandidatePresentation(pages,controlledCandidate);
      const posterFailure=await candidates.failPosterOnce(0);
      const cacheControl=await diagnostics.context.newCDPSession(diagnostics.page);
      try{
        await cacheControl.send('Network.setCacheDisabled',{cacheDisabled:true});
        posterPresentation.bind(posterRoom.room);
        await Promise.all(pages.map(page=>page.goto(`/room/${posterRoom.room.code}`,{waitUntil:'domcontentloaded'})));
        await expect(diagnostics.page.getByRole('button',{name:/want to watch/})).toHaveCount(2);
        await expect.poll(()=>posterFailure.calls(),{timeout:10000}).toBeGreaterThanOrEqual(1);
        const retryPoster=diagnostics.page.getByRole('button',{name:'Retry poster',exact:true});
        if(await retryPoster.isVisible())await retryPoster.dispatchEvent('click');
        await candidates.available();expect(posterFailure.calls()>=2).toBe(true);posterPresentation.assertHealthy();
      }finally{await cacheControl.detach();await posterFailure.close();await posterPresentation.close();}
      previous=committedRoomSnapshot(posterRoom.room);

      const noPoster=await next('no-poster');
      await compatible(pages,api!,noPoster.room,[[['action'],2000,2010],[['drama'],2000,2010]]);
      if(committedRoomSnapshot(noPoster.room).row.candidate_acquisition_status==='pending')
        preassembleAssignedCandidate(noPoster.room,controlledCandidate.tmdbMovieId);
      const noPosterPresentation=await installAssignedCandidatePresentation(pages,
        {...controlledCandidate,posterUrl:null});
      try{
        noPosterPresentation.bind(noPoster.room);
        await Promise.all(pages.map(page=>page.goto(`/room/${noPoster.room.code}`,{waitUntil:'domcontentloaded'})));
        for(const page of pages){const fallback=page.getByTestId('candidate-poster-fallback');await expect(fallback).toBeVisible();
          await expect(fallback).toHaveAttribute('aria-label',`No poster available for ${controlledCandidate.title}`);
          await expect(page.getByText('No poster available.',{exact:true})).toBeVisible();
          await expect(page.getByRole('button',{name:/want to watch/})).toHaveCount(2);}
        noPosterPresentation.assertHealthy();
      }finally{await noPosterPresentation.close();}
      expect(committedRoomSnapshot(noPoster.room).row.decision_completed_count===0).toBe(true);
      const provider=await tmdbSnapshot();expect(provider.invalid===0).toBe(true);
      expect(group.reduce((sum,item)=>sum+item.signupAttempts,0)===budget.J03).toBe(true);
      await diagnostics.record({scenario:'J03',outcome:'two identities reused; timeout rate 5xx malformed limit retry; response abort; assigned and metadata recovery; poster retry; null poster; same identity; identities2'});
    }finally{await candidates.close();}
  }));
});
