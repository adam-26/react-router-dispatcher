// @flow
import React from 'react';
import { createStore, combineReducers } from 'redux';
import { Provider } from 'react-redux';
import { mount } from 'enzyme';
import { STATIC_DISPATCHER_METHOD } from '../src/utils';
import {
    withDispatcher,
    routeContainer,
    reducer as asyncDispatcherReducer
} from '../src';

function initStore(initialState = {}) {
  return createStore(combineReducers({ routeDispatcher: asyncDispatcherReducer }), {
    routeDispatcher: Object.assign({}, { loaded: false, loadState: {} }, initialState),
  });
}

const TestRouteComponent = () => (<div>hello world</div>);
const RouteDispatcherComponent = withDispatcher((store, match, helper) => ({
  store,
  match,
  helper,
}))(TestRouteComponent);

const RouteContainer = routeContainer()(RouteDispatcherComponent);

describe('routeContainer()', function suite() {
  const HOC = routeContainer({
    onLoad: () => (<div>loading</div>),
    onError: ({ error }) => (<div>{error}</div>),
  })(() => (<div>component</div>));

  it('should invoke the async dispatcher of the route component', function test() {
    const args = {
      store: { dispatch: data => data },
      match: { url: 'url' },
      helper: {},
    };
    const result = RouteContainer[STATIC_DISPATCHER_METHOD](args.store, args.match, args.helper);

    const { data } = result.payload;
    expect(data.store).toEqual(args.store);
    expect(data.match).toEqual(args.match);
    expect(data.helper).toEqual(args.helper);
  });

  it('should render route component when global load not complete', function test() {
    const store = initStore();
    const result = mount(<Provider store={store}><HOC route={{ path: '/' }} /></Provider>);
    expect(result.text()).toContain('loading');
  });

  it('should render loading when route is loading', function test() {
    const store = initStore({ loadState: { '/': { loading: true } } });
    const result = mount(<Provider store={store}><HOC route={{ path: '/' }} /></Provider>);
    expect(result.text()).toContain('loading');
  });

  it('should render error when path fails to load', function test() {
    const store = initStore({ loadState: { '/': { error: 'error message' } } });
    const result = mount(<Provider store={store}><HOC route={{ path: '/' }} /></Provider>);
    expect(result.text()).toContain('error message');
  });

  it('should render route component on successful load', function test() {
    const store = initStore({ loaded: true, loadState: { '/': { loaded: true, loading: false } } });
    const result = mount(<Provider store={store}><HOC route={{ path: '/' }} /></Provider>);
    expect(result.text()).toContain('component');
  });

  const HOCFallback = routeContainer()(() => (<div>component</div>));

  it('should render route component when global load not complete', function test() {
    const store = initStore();
    const result = mount(<Provider store={store}><HOCFallback route={{ path: '/' }} /></Provider>);
    expect(result.text()).toContain('component');
  });

  it('should render route component when route is loading', function test() {
    const store = initStore({ loadState: { '/': { loading: true } } });
    const result = mount(<Provider store={store}><HOCFallback route={{ path: '/' }} /></Provider>);
    expect(result.text()).toContain('component');
  });

  it('should render route component when path fails to load', function test() {
    const store = initStore({ loadState: { '/': { error: 'error message' } } });
    const result = mount(<Provider store={store}><HOCFallback route={{ path: '/' }} /></Provider>);
    expect(result.text()).toContain('component');
  });

  it('should render route component on successful load', function test() {
    const store = initStore({ loaded: true, loadState: { '/': { loaded: true, loading: false } } });
    const result = mount(<Provider store={store}><HOCFallback route={{ path: '/' }} /></Provider>);
    expect(result.text()).toContain('component');
  });

  it('should render using custom reducer name', function test() {
    const reducerName = 'customReducerName';
    const CustomHOC = routeContainer({ reducerName })(() => (<div>custom</div>));
    const store = createStore(combineReducers({ [reducerName]: asyncDispatcherReducer }), {
      [reducerName]: Object.assign({}, { loaded: true, loadState: { '/': { loaded: true } } }),
    });
    const result = mount(<Provider store={store}><CustomHOC route={{ path: '/' }} /></Provider>);
    expect(result.text()).toContain('custom');
  });
});
