import { fireEvent, render, screen } from '@testing-library/react-native';
import { ParticipantFilterForm } from '../../src/filters/participant-filter-form';
import type { ParticipantFilterModel } from '../../src/filters/use-participant-filter';

const model: ParticipantFilterModel = {
  roomId: '11111111-1111-4111-8111-111111111111', recovery: 'absent', accepted: null,
  draft: { genres: [], releaseYearFrom: '1900', releaseYearTo: '2026' }, submission: 'idle',
  message: null, allowedReleaseYearMax: 2026, filterCompletedCount: 0, requiredVoterCount: 3,
  filtersComplete: false, canSave: true, syncDegraded: false, toggleGenre: jest.fn(),
  setReleaseYearFrom: jest.fn(), setReleaseYearTo: jest.fn(), save: jest.fn(), retrySave: jest.fn(),
  retryRecovery: jest.fn(), resetDraft: jest.fn(),
};

it('renders accessible Any, all 19 toggles, required years and aggregate progress',()=>{
  render(<ParticipantFilterForm model={model}/>);
  expect(screen.getByText('0 of 3 filters collected')).toBeVisible();
  expect(screen.getByText('Any genre')).toBeVisible();
  expect(screen.getAllByRole('checkbox')).toHaveLength(19);
  expect(screen.getByRole('checkbox',{name:'Science Fiction'})).toHaveProp('accessibilityState',
    expect.objectContaining({checked:false}));
  expect(screen.getByLabelText('Release year from')).toHaveProp('value','1900');
  expect(screen.getByLabelText('Release year to')).toHaveProp('value','2026');
  fireEvent.press(screen.getByRole('checkbox',{name:'Action'}));
  fireEvent.changeText(screen.getByLabelText('Release year from'),'2000');
  expect(model.toggleGenre).toHaveBeenCalledWith('action');expect(model.setReleaseYearFrom).toHaveBeenCalledWith('2000');
});

it.each([
  [{...model,recovery:'loading' as const,draft:null},'Loading your filters…','Retry filter recovery'],
  [{...model,recovery:'error' as const,draft:null,message:'Unable to load your filters. Please try again.'},'Unable to load your filters. Please try again.','Retry filter recovery'],
])('keeps recovery state bounded without guessing defaults %#',(input,text,retry)=>{
  render(<ParticipantFilterForm model={input}/>);expect(screen.getByText(text)).toBeVisible();
  expect(screen.queryByRole('checkbox')).toBeNull();
  if(input.recovery==='error')expect(screen.getByRole('button',{name:retry})).toBeVisible();
});

it('shows saved values separately from an unsaved replacement and keeps retry explicit',()=>{
  render(<ParticipantFilterForm model={{...model,recovery:'saved',accepted:{genres:['action'],releaseYearFrom:1990,releaseYearTo:2020},
    draft:{genres:['drama'],releaseYearFrom:'2000',releaseYearTo:'2024'},submission:'error',
    message:'Unable to save participant filters. Please try again.'}}/>);
  expect(screen.getByText('Saved filters: Action; 1990–2020')).toBeVisible();
  expect(screen.getByText('Unable to save participant filters. Please try again.')).toBeVisible();
  fireEvent.press(screen.getByRole('button',{name:'Retry saving filters'}));expect(model.retrySave).toHaveBeenCalled();
});

it('renders N/N progress and own values read-only while leaving resolution copy to its panel',()=>{
  render(<ParticipantFilterForm model={{...model,recovery:'locked',accepted:{genres:[],releaseYearFrom:1900,releaseYearTo:2026},
    draft:null,filterCompletedCount:3,filtersComplete:true,canSave:false}}/>);
  expect(screen.getByText('Your filters: Any genre; 1900–2026')).toBeVisible();
  expect(screen.queryByRole('checkbox')).toBeNull();expect(screen.queryByRole('button',{name:'Save filters'})).toBeNull();
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/Feature 005 is next|compatible|incompatible|resolving|movie|candidate|swipe|match/i);
});

it('keeps own-detail recovery available at N/N without owning shared resolution status',()=>{
  render(<ParticipantFilterForm model={{...model,recovery:'error',accepted:null,draft:null,
    message:'Unable to load your filters. Please try again.',filterCompletedCount:3,
    filtersComplete:true,canSave:false}}/>);
  expect(screen.getByText('3 of 3 filters collected')).toBeVisible();
  expect(screen.getByRole('button',{name:'Retry filter recovery'})).toBeVisible();
  expect(screen.queryByText(/compatible|incompatible|resolving/i)).toBeNull();
});

it('disables a new save while room synchronization is degraded',()=>{
  render(<ParticipantFilterForm model={{...model,syncDegraded:true,canSave:false}}/>);
  expect(screen.getByRole('button',{name:'Save filters'})).toBeDisabled();
});
