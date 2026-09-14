import { render,screen } from '@testing-library/react-native';
import { CandidateCard } from '../../src/candidates/candidate-card';
import type { useRoomCandidate } from '../../src/candidates/use-room-candidate';

const noOp=()=>{};
function presentation(posterUrl:string|null){return ({roomId:'room',eligible:true,
  authoritativeStatus:'assigned',generation:0,requestAttempt:0,imageAttempt:0,
  attempt:posterUrl?'available':'no-poster',status:posterUrl?'available':'no-poster',
  candidate:{tmdbMovieId:550,title:'Le Fabuleux Destin',releaseYear:2001,posterUrl},
  message:null,posterSource:posterUrl?{uri:posterUrl}:null,imageKey:'0:0:0',retry:noOp,onLoad:noOp,onError:noOp}) as unknown as
  ReturnType<typeof useRoomCandidate>;}

it('shows exactly current en-US title, release year and visible poster meaning',()=>{
  render(<CandidateCard model={presentation('https://image.tmdb.org/t/p/w500/a.jpg')}/>);
  expect(screen.getByRole('header',{name:'Le Fabuleux Destin'})).toBeVisible();
  expect(screen.getByText('2001')).toBeVisible();expect(screen.getByRole('image',{name:'Poster for Le Fabuleux Destin'})).toBeVisible();
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/550|overview|rating|runtime|cast|provider|swipe|next|match/i);
});

it('uses explicit confirmed no-poster meaning without an image request',()=>{
  render(<CandidateCard model={presentation(null)}/>);
  expect(screen.getByText('No poster available.')).toBeVisible();
  expect(screen.getByRole('image',{name:'No poster available for Le Fabuleux Destin'})).toBeVisible();
  expect(screen.queryByTestId('candidate-poster')).toBeNull();
});
