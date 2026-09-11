import { fireEvent, render, screen } from '@testing-library/react-native';
import { CommonFilterResolutionPanel } from '../../src/resolution/common-filter-resolution-panel';
import type { CommonFilterResolutionModel } from '../../src/resolution/use-common-filter-resolution';

const retry = jest.fn();
const base: CommonFilterResolutionModel = {
  request: { roomId: '11111111-1111-4111-8111-111111111111', generation: 0 },
  status: 'pending', attempt: 'resolving', message: null, retry,
};
function visibleText() { return JSON.stringify(screen.toJSON()); }

beforeEach(()=>jest.clearAllMocks());

it('shows only an accessible resolving status',()=>{
  render(<CommonFilterResolutionPanel model={base}/>);
  expect(screen.getByRole('header',{name:'Resolving common filters…'})).toBeVisible();
  expect(visibleText()).not.toMatch(/1900|2026|genre|clause|roster|member|user|candidate_id/i);
});

it('shows one explicit transient Retry without converting failure to incompatibility',()=>{
  render(<CommonFilterResolutionPanel model={{...base,attempt:'error',
    message:'Unable to resolve common filters. Please try again.'}}/>);
  expect(screen.getByText('Unable to resolve common filters. Please try again.')).toBeVisible();
  expect(screen.queryByText(/incompatible/i)).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Retry common-filter resolution'}));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('renders compatible as future sourcing meaning only',()=>{
  render(<CommonFilterResolutionPanel model={{...base,status:'compatible',attempt:'inactive'}}/>);
  expect(screen.getByRole('header',{name:'Filters are compatible.'})).toBeVisible();
  expect(screen.getByText('Movie candidate sourcing is the next step in a future feature.')).toBeVisible();
  expect(screen.queryByRole('button')).toBeNull();
  expect(visibleText()).not.toMatch(/release year|genre|clause|candidate_id|poster|title|swipe|match/i);
});

it('renders incompatible as frozen with only the existing new-room navigation',()=>{
  render(<CommonFilterResolutionPanel model={{...base,status:'incompatible',attempt:'inactive'}}/>);
  expect(screen.getByRole('header',{name:'Filters are incompatible.'})).toBeVisible();
  expect(screen.getByRole('link',{name:'Create a new room'})).toHaveProp('href','/');
  expect(screen.queryByRole('button')).toBeNull();
  expect(visibleText()).not.toMatch(/edit|reset|release year|genre|clause|candidate_id/i);
});

it('fails closed on integrity error and hides both terminal meanings and actions',()=>{
  render(<CommonFilterResolutionPanel model={{...base,status:'compatible',attempt:'integrity-error',
    message:'Unable to verify common-filter status. Reload the room and try again.'}}/>);
  expect(screen.getByText('Common-filter status could not be verified.')).toBeVisible();
  expect(screen.queryByText('Filters are compatible.')).toBeNull();
  expect(screen.queryByText('Filters are incompatible.')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByRole('link',{name:'Create a new room'})).toBeNull();
});

