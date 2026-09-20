import { fireEvent, render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import * as Reanimated from 'react-native-reanimated';
import { CandidateDecisionSurface, decisionForRelease } from '../../src/decisions/candidate-decision-surface';

const submit = jest.fn(), retry = jest.fn();
const candidate = { roomId: '11111111-1111-4111-8111-111111111111', eligible: true,
  authoritativeStatus: 'assigned', generation: 1, requestAttempt: 0, imageAttempt: 0,
  attempt: 'no-poster', status: 'no-poster', candidate: { tmdbMovieId: 42,
    title: 'Same Candidate', releaseYear: 2020, posterUrl: null }, message: null,
  posterSource: null, imageKey: '1:0:0', retry: jest.fn(), onLoad: jest.fn(), onError: jest.fn() } as const;
const projection = { myDecision: null, completedCount: 0, requiredVoterCount: 2,
  decisionSetComplete: false, twoVoterAgreement: false } as const;
const decision = { generation: { roomId: candidate.roomId!, tmdbMovieId: 42 },
  availability: 'voter', kind: 'undecided', projection, pendingIntent: null, notice: null,
  controlsVisible: true, controlsEnabled: true, submit, retry } as const;

beforeEach(() => jest.clearAllMocks());

function mount(patch: Record<string, unknown> = {}) {
  render(<CandidateDecisionSurface candidate={candidate as never}
    decision={{ ...decision, ...patch } as never} />);
  fireEvent(screen.getByTestId('candidate-decision-surface'), 'layout',
    { nativeEvent: { layout: { width: 360 } } });
}

it.each([[90, 0, 'yes'], [-90, 0, 'no']] as const)(
  'a qualifying Pan release (%s,%s) submits %s once', (translationX, translationY, value) => {
    mount();
    fireGestureHandler(getByGestureTestId('candidate-decision-pan'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX, translationY, numberOfPointers: 1 },
      { state: State.END, translationX, translationY, numberOfPointers: 1 },
    ]);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(value);
  });

it('makes below-threshold and non-dominant releases no-ops', () => {
  expect(decisionForRelease(360, 89.99, 0)).toBeNull();
  expect(decisionForRelease(360, 100, 81)).toBeNull();
  mount();
  fireGestureHandler(getByGestureTestId('candidate-decision-pan'), [
    { translationX: 60, translationY: 0, numberOfPointers: 1 },
  ]);
  expect(submit).not.toHaveBeenCalled();
});

it('routes persistent labeled alternatives through the same callback', () => {
  mount();
  fireEvent.press(screen.getByRole('button', { name: "No — don't want to watch" }));
  fireEvent.press(screen.getByRole('button', { name: 'Yes — want to watch' }));
  expect(submit.mock.calls).toEqual([['no'], ['yes']]);
});

it('preserves candidate title/year while a non-voting creator has no controls', () => {
  mount({ availability: 'observer', kind: 'unavailable', controlsVisible: false,
    controlsEnabled: false, projection: { ...projection, completedCount: 1 } });
  expect(screen.getByText('Same Candidate')).toBeVisible();
  expect(screen.getByText('2020')).toBeVisible();
  expect(screen.queryByRole('button', { name: /want to watch/ })).toBeNull();
  expect(submit).not.toHaveBeenCalled();
});

it('shows recovery, submission and authoritative status without optimistic acceptance', () => {
  const view = render(<CandidateDecisionSurface candidate={candidate as never}
    decision={{ ...decision, kind: 'submitting', controlsEnabled: false,
      pendingIntent: 'yes' } as never} />);
  expect(screen.getByText('Saving your Yes choice…')).toBeVisible();
  expect(screen.queryByText('You chose Yes')).toBeNull();
  view.rerender(<CandidateDecisionSurface candidate={candidate as never}
    decision={{ ...decision, kind: 'decided', controlsEnabled: false,
      projection: { ...projection, myDecision: 'yes', completedCount: 1 } } as never} />);
  expect(screen.getByText('You chose Yes')).toBeVisible();
});

it.each([['yes', 'You chose Yes'], ['no', 'You chose No']] as const)(
  'shows authoritative accepted %s and disables both controls', (value, text) => {
    mount({ kind: 'decided', controlsEnabled: false,
      projection: { ...projection, myDecision: value, completedCount: 1 } });
    expect(screen.getByText(text)).toBeVisible();
    expect(screen.getByRole('button', { name: "No — don't want to watch" })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Yes — want to watch' })).toBeDisabled();
  });

it('announces a recovered conflict winner and an uncertain failure with Retry', () => {
  const view = render(<CandidateDecisionSurface candidate={candidate as never}
    decision={{ ...decision, kind: 'decided', controlsEnabled: false, notice: 'conflict',
      projection: { ...projection, myDecision: 'no', completedCount: 1 } } as never} />);
  expect(screen.getByText('You chose No earlier. That choice remains saved.')).toBeVisible();
  view.rerender(<CandidateDecisionSurface candidate={candidate as never}
    decision={{ ...decision, kind: 'recoverable-error', controlsEnabled: false } as never} />);
  expect(screen.getByText('Unable to confirm your choice. Please retry.')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Retry decision recovery' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Same Candidate')).toBeVisible();
});

it.each([
  [200, 72, 0, 'yes'], [200, -72, 0, 'no'], [360, 90, 72, 'yes'],
  [1000, 120, 96, 'yes'], [1000, -120, -96, 'no'],
] as const)('uses clamped width and inclusive 1.25 dominance at %s/%s/%s', (width, x, y, value) => {
  expect(decisionForRelease(width, x, y)).toBe(value);
  expect(decisionForRelease(width, x, Math.abs(x / 1.25) + 0.01)).toBeNull();
});

it('configures one-pointer horizontal activation and vertical failure exactly', () => {
  mount();
  const gesture = getByGestureTestId('candidate-decision-pan') as unknown as {
    config: { maxPointers: number; activeOffsetXStart: number; activeOffsetXEnd: number;
      failOffsetYStart: number; failOffsetYEnd: number; enabled: boolean };
  };
  expect(gesture.config).toMatchObject({ maxPointers: 1, activeOffsetXStart: -12,
    activeOffsetXEnd: 12, failOffsetYStart: -24, failOffsetYEnd: 24, enabled: true });
});

it.each([
  [{ state: State.CANCELLED, translationX: 120, translationY: 0, numberOfPointers: 1 }],
  [{ state: State.FAILED, translationX: 120, translationY: 0, numberOfPointers: 1 }],
  [{ state: State.ACTIVE, translationX: 120, translationY: 0, numberOfPointers: 2 }],
  [{ state: State.END, translationX: 120, translationY: 100, numberOfPointers: 1 }],
] as const)('rejects cancel/fail/multi-touch/vertical gesture %#', event => {
  mount();
  fireGestureHandler(getByGestureTestId('candidate-decision-pan'), [event]);
  expect(submit).not.toHaveBeenCalled();
});

it('disables the Pan and persistent controls while busy or decided', () => {
  mount({ kind: 'submitting', controlsEnabled: false, pendingIntent: 'yes' });
  const gesture = getByGestureTestId('candidate-decision-pan') as unknown as {
    config: { enabled: boolean };
  };
  expect(gesture.config.enabled).toBe(false);
  expect(screen.getByRole('button', { name: "No — don't want to watch" })).toHaveProp('accessibilityState', {
    disabled: true, busy: true,
  });
  fireGestureHandler(gesture as never, [{ translationX: 120, translationY: 0 }]);
  expect(submit).not.toHaveBeenCalled();
});

it('resets accepted motion with system reduced-motion semantics', () => {
  const spring = jest.spyOn(Reanimated, 'withSpring');
  mount();
  fireGestureHandler(getByGestureTestId('candidate-decision-pan'), [
    { translationX: 100, translationY: 0, numberOfPointers: 1 },
  ]);
  expect(spring).toHaveBeenCalledWith(0, expect.objectContaining({
    reduceMotion: Reanimated.ReduceMotion.System,
  }));
});

it('keeps both equivalent controls at least 44 points with meaningful roles and reading order', () => {
  mount();
  const buttons = screen.getAllByRole('button', { name: /want to watch/ });
  expect(buttons).toHaveLength(2);
  expect(buttons[0]).toHaveStyle({ minHeight: 44 });
  expect(buttons[1]).toHaveStyle({ minHeight: 44 });
  expect(screen.getByText('Choose Yes or No for this candidate.')).toHaveProp(
    'accessibilityLiveRegion', 'polite');
});

it.each([
  [1, 2, false, 'collecting', 'collecting', '1 of 2 decisions collected.'],
  [2, 2, true, 'agreed', 'agreed', '2 of 2 decisions collected.'],
  [2, 2, true, 'rejected', 'advancing', '2 of 2 decisions collected.'],
  [3, 3, true, 'agreed', 'agreed', '3 of 3 decisions collected.'],
] as const)('shows neutral aggregate progress without inventing larger policy %#',
  (completedCount, requiredVoterCount, decisionSetComplete,candidateOutcome,
    candidateProgressionStatus,progress) => {
    mount({ kind: 'decided', controlsEnabled: false, projection: { myDecision: 'yes', completedCount,
      candidateSequence:1,requiredVoterCount, decisionSetComplete,
      agreementThreshold:requiredVoterCount===2?2:2,candidateOutcome,candidateProgressionStatus } });
    expect(screen.getByText(progress)).toBeVisible();
    expect(screen.queryByText(/Current candidate agreement/)).toBeNull();
    expect(screen.queryByText(/next candidate|match|celebrat/i)).toBeNull();
  });
