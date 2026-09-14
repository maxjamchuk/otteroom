import { fireEvent, render, screen } from '@testing-library/react-native';
import { Image, StyleSheet } from 'react-native';
import { CandidateCard } from '../../src/candidates/candidate-card';
import type { useRoomCandidate } from '../../src/candidates/use-room-candidate';

const retry=jest.fn(),onLoad=jest.fn(),onError=jest.fn();
const candidate={tmdbMovieId:7,title:'TMDB Film',releaseYear:2020,
  posterUrl:'https://image.tmdb.org/t/p/w500/a.jpg'};
function model(patch:Record<string,unknown>={}){
  return ({roomId:'room',eligible:true,authoritativeStatus:'assigned',generation:1,requestAttempt:0,
    imageAttempt:0,attempt:'available',status:'available',candidate,message:null,
    posterSource:{uri:candidate.posterUrl},imageKey:'1:0:0',retry,onLoad,onError,...patch}) as unknown as
    ReturnType<typeof useRoomCandidate>;
}
beforeEach(()=>jest.clearAllMocks());

it('renders exact title/year/accessible bounded HTTPS poster and no advanced controls or ID',()=>{
  render(<CandidateCard model={model()}/>);
  expect(screen.getByRole('header',{name:'TMDB Film'})).toBeVisible(); expect(screen.getByText('2020')).toBeVisible();
  const image=screen.UNSAFE_getByType(Image); expect(image.props.source).toEqual({uri:candidate.posterUrl});
  expect(image.props.accessibilityLabel).toBe('Poster for TMDB Film');
  expect(StyleSheet.flatten(image.props.style)).toMatchObject({width:'100%',maxWidth:240,aspectRatio:2/3});
  const text=JSON.stringify(screen.toJSON()); expect(text).not.toMatch(/tmdbMovieId|overview|rating|runtime|cast|provider|swipe|next|match|fixture/i);
  expect(screen.queryByRole('button')).toBeNull();
});

it('shows finding and metadata states without speculative identity',()=>{
  const view=render(<CandidateCard model={model({attempt:'acquiring',status:'acquiring',candidate:null,
    posterSource:null,message:'Finding a movie…'})}/>);
  expect(screen.getByText('Finding a movie…')).toBeVisible(); expect(screen.queryByTestId('candidate-title')).toBeNull();
  view.rerender(<CandidateCard model={model({attempt:'loading-metadata',status:'loading-metadata',candidate:null,
    posterSource:null,message:'Loading movie details…'})}/>);
  expect(screen.getByText('Loading movie details…')).toBeVisible();
});

it.each([['acquisition-error','Retry finding a movie'],['metadata-error','Retry movie details'],
  ['poster-error','Retry poster']] as const)('routes %s to exactly one applicable action',(attempt,label)=>{
  render(<CandidateCard model={model({attempt,status:attempt,candidate:attempt==='acquisition-error'?null:candidate,
    posterSource:attempt==='acquisition-error'?null:{uri:candidate.posterUrl},message:'Safe failure'})}/>);
  fireEvent.press(screen.getByRole('button',{name:label})); expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole('button')).toHaveLength(1);
});

it('retains title/year through poster failure and routes only poster callbacks',()=>{
  render(<CandidateCard model={model({attempt:'poster-error',status:'poster-error',message:'Unable to load this poster. Please try again.'})}/>);
  expect(screen.getByText('TMDB Film')).toBeVisible(); expect(screen.getByText('2020')).toBeVisible();
  fireEvent(screen.getByRole('image'),'load'); fireEvent(screen.getByRole('image'),'error');
  expect(onLoad).toHaveBeenCalledTimes(1);expect(onError).toHaveBeenCalledTimes(1);
});

it('renders explicit confirmed no-poster fallback',()=>{
  render(<CandidateCard model={model({attempt:'no-poster',status:'no-poster',
    candidate:{...candidate,posterUrl:null},posterSource:null})}/>);
  expect(screen.getByLabelText('No poster available for TMDB Film')).toBeVisible();
  expect(screen.getByText('No poster available.')).toBeVisible(); expect(screen.queryByTestId('candidate-poster')).toBeNull();
});

it('renders stable completed-empty meaning and new-room link without acquisition Retry',()=>{
  render(<CandidateCard model={model({attempt:'no-candidates',status:'no-candidates',candidate:null,
    posterSource:null,message:'No eligible movie was observed during the completed search.'})}/>);
  expect(screen.getByText('No eligible movie was observed during the completed search.')).toBeVisible();
  expect(screen.getByRole('link',{name:'Create a new room'})).toHaveProp('href','/');
  expect(screen.queryByRole('button')).toBeNull();
});

it('fails closed on integrity error',()=>{
  render(<CandidateCard model={model({attempt:'integrity-error',status:'integrity-error',candidate:null,
    posterSource:null,message:'Candidate status could not be verified. Reload the room and try again.'})}/>);
  expect(screen.queryByTestId('candidate-title')).toBeNull(); expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
});
