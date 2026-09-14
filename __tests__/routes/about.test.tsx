import {fireEvent,renderRouter,screen} from 'expo-router/testing-library';
import HomeScreen from '../../app/index';
import AboutScreen from '../../app/about';
jest.mock('../../src/rooms/service',()=>({createRoom:jest.fn()}));

it('normal navigation reaches accessible, subordinate TMDB attribution and returns home',()=>{
  const view=renderRouter({index:HomeScreen,about:AboutScreen},{initialUrl:'/'});
  fireEvent.press(screen.getByRole('link',{name:'About and credits'}));
  expect(view.getPathname()).toBe('/about');
  expect(screen.getByRole('header',{name:'Otteroom credits'})).toBeVisible();
  expect(screen.getByRole('image',{name:'TMDB logo'})).toBeVisible();
  expect(screen.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.')).toBeVisible();
  expect(screen.getByRole('link',{name:'Visit TMDB'})).toHaveProp('href','https://www.themoviedb.org');
  expect(screen.getByTestId('tmdb-logo').props.style).toMatchObject({width:160,aspectRatio:330/238});
  expect(screen.getByTestId('otteroom-brand').props.style).toMatchObject({fontSize:28});
  fireEvent.press(screen.getByRole('link',{name:'Back to Otteroom'}));expect(view.getPathname()).toBe('/');
});
