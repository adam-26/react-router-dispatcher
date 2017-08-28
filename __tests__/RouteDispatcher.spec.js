import Promise from 'bluebird';
import React from 'react';
import { Provider } from 'react-redux';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { combineReducers as combineImmutableReducers } from 'redux-immutable';
import { mount, render } from 'enzyme';
import { spy } from 'sinon';
import Immutable from 'immutable';
import { routerReducer } from 'react-router-redux';
import { renderRoutes } from 'react-router-config';
import { StaticRouter, MemoryRouter } from 'react-router-dom';
import thunk from 'redux-thunk';
import createSagaMiddleware, { END, takeEvery, delay } from 'redux-saga';
import { call, all, put } from 'redux-saga/effects';

// import module
import { setToImmutableStateFunc, setToMutableStateFunc } from '../src/state';
import { endGlobalLoad, beginGlobalLoad, createImmutableReducer } from '../src/store';
import { createRouteDispatcher } from '../src/containers/RouteDispatcher';
import {
  connectDispatcher,
  reducer as asyncDispatcherReducer,
  immutableReducer,
  dispatchOnServer
} from '../src/index';

describe('<RouteDispatcher />', function suite() {
  const initialState = {
    router: {},
    routeDispatcher: { loaded: false, loadState: {}, $$external: 'supported' },
    testData: { value: null },
  };

  const asyncTimeout = 2500;

  const mockSyncAction = text => ({ type: 'applyValue', payload: text });
  const mockAsyncAction = text => dispatch => new Promise((resolve) => {
    setTimeout(() => {
      dispatch(mockSyncAction(text));
      resolve();
    }, asyncTimeout);
  });

  const mockNestedSyncAction = text => ({ type: 'applyHeading', payload: text });
  const mockNestedAsyncAction = text => dispatch => new Promise((resolve) => {
    setTimeout(() => {
      dispatch(mockNestedSyncAction(text));
      resolve();
    }, asyncTimeout);
  });

  const testDataReducer = (state = { value: null }, action) => {
    switch (action.type) {
      case 'applyValue':
        return {
          value: action.payload,
        };
      default:
        return state;
    }
  };

  const nestedRouteDataReducer = (state = { value: null }, action) => {
    switch (action.type) {
      case 'applyHeading':
        return {
          heading: action.payload,
        };
      default:
        return state;
    }
  };

  const endGlobalLoadSpy = spy(endGlobalLoad);
  const beginGlobalLoadSpy = spy(beginGlobalLoad);
  const mockSyncActionSpy = spy(mockSyncAction);
  const mockAsyncActionSpy = spy(mockAsyncAction);
  const mockNestedAsyncActionSpy = spy(mockNestedAsyncAction);

  const RouteDispatcher = createRouteDispatcher(beginGlobalLoadSpy, endGlobalLoadSpy);

  const RootComponent = ({ route }) => (
    <div>
      {/* Child routes won't render without this */}
      {renderRoutes(route.routes)}
    </div>
  );

  const NestedRouteComponent = ({ route, nestedRouteHeading }) => (
    <div>
      <div>{nestedRouteHeading}</div>
      {/* Child routes won't render without this */}
      {renderRoutes(route.routes)}
    </div>
  );

  const NestedRouteContainer = connectDispatcher(
  ({ dispatch }) => dispatch(mockNestedAsyncActionSpy('Nested Route')),
  state => ({
    nestedRouteHeading: state.nestedRouteData.heading,
  }))(NestedRouteComponent);

  const ContentComponent = ({
   value,
  }) => <div>{value}</div>;

  const SyncContentContainer = connectDispatcher(
  ({ dispatch }) => dispatch(mockSyncActionSpy('sandwich')),
  state => ({
    value: state.testData.value,
  }))(ContentComponent);

  const AsyncContentContainer = connectDispatcher(
  ({ dispatch }) => dispatch(mockAsyncActionSpy('breakfast')),
  state => ({
    value: state.testData.value,
  }))(ContentComponent);

  const LOAD_ASYNC_SAGA_DATA_ACTION = 'LOAD_ASYNC_SAGA_DATA';
  const loadSagaAction = value => ({ type: LOAD_ASYNC_SAGA_DATA_ACTION, payload: { value } });

  const AsyncSagaContainer = connectDispatcher(
  ({ dispatch }) => dispatch(loadSagaAction('lunch')),
  state => ({
    value: state.testData.value,
  }))(ContentComponent);

  function* loadAsyncSagaData(action) {
    yield call(delay, asyncTimeout);
    yield put(mockSyncAction(action.payload.value));
  }

  function* watchForAsyncLoad() {
    yield takeEvery(LOAD_ASYNC_SAGA_DATA_ACTION, loadAsyncSagaData);
  }

  const rootSaga = function* rootSaga() {
    yield all([
      call(watchForAsyncLoad),
    ]);
  };

  const RegularComponent = () => <div>Hi, I do not use @asyncConnect</div>;
  const reducers = combineReducers({
    router: routerReducer,
    routeDispatcher: asyncDispatcherReducer,
    testData: testDataReducer,
    nestedRouteData: nestedRouteDataReducer,
  });

  const routes = [
    { component: RootComponent,
      routes: [
        { path: '/sync',
          exact: true,
          component: SyncContentContainer,
        },
        { path: '/async',
          exact: true,
          component: AsyncContentContainer,
        },
        { path: '/asyncSaga',
          exact: true,
          component: AsyncSagaContainer,
        },
        {
          path: '/nested',
          component: NestedRouteContainer,
          routes: [
            { path: '/nested/async',
              component: AsyncContentContainer,
              exact: true,
            },
          ],
        },
        { path: '/notconnected',
          component: RegularComponent,
        },
      ],
    },
  ];

  // inter-test state
  let testState;

  it('loads synchronous data on the server', function test() {
    return new Promise((resolve) => {
      const store = createStore(reducers, initialState);
      const location = '/sync';
      const reactRouterContext = {};

      dispatchOnServer(store, routes, location, {}).then(() => {
        const html = render(
          <Provider store={store} key="provider">
            <StaticRouter location={location} context={reactRouterContext}>
              <RouteDispatcher routes={routes} />
            </StaticRouter>
          </Provider>
        );

        expect(html.text()).toContain('sandwich');
        testState = store.getState();
        expect(testState.routeDispatcher.loaded).toBe(true);
        expect(testState.routeDispatcher.loadState[location].loading).toBe(false);
        expect(testState.routeDispatcher.loadState[location].loaded).toBe(true);
        expect(testState.routeDispatcher.loadState[location].error).toBe(null);

        // global loader spy
        expect(endGlobalLoadSpy.called).toBe(false);
        expect(beginGlobalLoadSpy.called).toBe(false);

        resolve();
      });
    });
  });

  it('loads asynchronous data using sage on the server', function test() {
    return new Promise((resolve) => {
      const sagaMiddleware = createSagaMiddleware();
      const store = createStore(reducers, initialState, applyMiddleware(sagaMiddleware));
      const location = '/asyncSaga';
      const reactRouterContext = {};

      // #1. Run the root saga
      const sagaPromise = sagaMiddleware.run(rootSaga);

      // #2. Invoke all async dispatchers to run required sagas
      dispatchOnServer(store, routes, location, {}).then(() => {
        // #3. Inform saga that all actions have been dispatched
        store.dispatch(END);

        // #4. Render after the saga promise is done
        sagaPromise.done.then(() => {
          const html = render(
            <Provider store={store} key="provider">
              <StaticRouter location={location} context={reactRouterContext}>
                <RouteDispatcher routes={routes} />
              </StaticRouter>
            </Provider>
          );

          expect(html.text()).toContain('lunch');
          testState = store.getState();
          expect(testState.routeDispatcher.loaded).toBe(true);
          expect(testState.routeDispatcher.loadState[location].loading).toBe(false);
          expect(testState.routeDispatcher.loadState[location].loaded).toBe(true);
          expect(testState.routeDispatcher.loadState[location].error).toBe(null);

          // global loader spy
          expect(endGlobalLoadSpy.called).toBe(false);
          expect(beginGlobalLoadSpy.called).toBe(false);

          resolve();
        });
      });
    });
  });

  it('loads asynchronous data using thunk on the server', function test() {
    return new Promise((resolve) => {
      const store = createStore(reducers, initialState, applyMiddleware(thunk));
      const location = '/async';
      const reactRouterContext = {};

      dispatchOnServer(store, routes, location, {}).then(() => {
        const html = render(
          <Provider store={store} key="provider">
            <StaticRouter location={location} context={reactRouterContext}>
              <RouteDispatcher routes={routes} />
            </StaticRouter>
          </Provider>
        );

        expect(html.text()).toContain('breakfast');
        testState = store.getState();
        expect(testState.routeDispatcher.loaded).toBe(true);
        expect(testState.routeDispatcher.loadState[location].loading).toBe(false);
        expect(testState.routeDispatcher.loadState[location].loaded).toBe(true);
        expect(testState.routeDispatcher.loadState[location].error).toBe(null);

        // global loader spy
        expect(endGlobalLoadSpy.called).toBe(false);
        expect(beginGlobalLoadSpy.called).toBe(false);

        resolve();
      });
    });
  });

  it('picks data up from the server', function test() {
    const store = createStore(reducers, testState);
    const proto = RouteDispatcher.WrappedComponent.prototype;
    const location = '/async';

    spy(proto, 'loadAsyncData');
    spy(proto, 'componentDidMount');

    const wrapper = mount(
      <Provider store={store} key="provider">
        <MemoryRouter initialEntries={[location]} initialIndex={0}>
          <RouteDispatcher routes={routes} />
        </MemoryRouter>
      </Provider>
    );

    expect(proto.loadAsyncData.called).toBe(false);
    expect(proto.componentDidMount.calledOnce).toBe(true);

    expect(wrapper.find(ContentComponent).length).toBe(1);
    expect(wrapper.find(ContentComponent).prop('value')).toBe('breakfast');

    // global loader spy
    expect(endGlobalLoadSpy.called).toBe(false);
    expect(beginGlobalLoadSpy.called).toBe(false);

    proto.loadAsyncData.restore();
    proto.componentDidMount.restore();
  });

  it('loads asynchronous data on nested routes', function test() {
    return new Promise((resolve) => {
      const store = createStore(reducers, initialState, applyMiddleware(thunk));
      const location = '/nested/async';
      const reactRouterContext = {};

      dispatchOnServer(store, routes, location, {}).then(() => {
        const html = render(
          <Provider store={store} key="provider">
            <StaticRouter location={location} context={reactRouterContext}>
              <RouteDispatcher routes={routes} />
            </StaticRouter>
          </Provider>
        );

        expect(html.text()).toContain('Nested Route');
        expect(html.text()).toContain('breakfast');
        testState = store.getState();
        expect(testState.routeDispatcher.loaded).toBe(true);
        expect(testState.routeDispatcher.loadState['/nested'].loading).toBe(false);
        expect(testState.routeDispatcher.loadState['/nested'].loaded).toBe(true);
        expect(testState.routeDispatcher.loadState['/nested'].error).toBe(null);
        expect(testState.routeDispatcher.loadState[location].loading).toBe(false);
        expect(testState.routeDispatcher.loadState[location].loaded).toBe(true);
        expect(testState.routeDispatcher.loadState[location].error).toBe(null);

        // global loader spy
        expect(endGlobalLoadSpy.called).toBe(false);
        expect(beginGlobalLoadSpy.called).toBe(false);

        // action spys
        expect(mockAsyncActionSpy.called).toBe(true);
        expect(mockNestedAsyncActionSpy.called).toBe(true);
        mockAsyncActionSpy.reset();
        mockNestedAsyncActionSpy.reset();

        resolve();
      });
    });
  });

  it('loads data on client side when it wasn\'t provided by server', function test() {
    const store = createStore(reducers, initialState, applyMiddleware(thunk));
    const proto = RouteDispatcher.WrappedComponent.prototype;
    const location = '/async';

    spy(proto, 'loadAsyncData');
    spy(proto, 'componentDidMount');

    const wrapper = mount(
      <Provider store={store} key="provider">
        <MemoryRouter initialEntries={[location]} initialIndex={0}>
          <RouteDispatcher routes={routes} />
        </MemoryRouter>
      </Provider>
    );

    expect(proto.loadAsyncData.calledOnce).toBe(true);
    expect(proto.componentDidMount.calledOnce).toBe(true);

    // global loader spy
    expect(beginGlobalLoadSpy.called).toBe(true);
    beginGlobalLoadSpy.reset();

    return proto.loadAsyncData.returnValues[0].then(() => {
      expect(endGlobalLoadSpy.called).toBe(true);
      endGlobalLoadSpy.reset();

      expect(wrapper.find(ContentComponent).length).toBe(1);
      expect(wrapper.find(ContentComponent).prop('value')).toBe('breakfast');

      proto.loadAsyncData.restore();
      proto.componentDidMount.restore();
    });
  });

  it('renders when no component is connected', function test() {
    return new Promise((resolve) => {
      const store = createStore(reducers);

      const location = '/notconnected';
      const reactRouterContext = {};

      dispatchOnServer(store, routes, location, {}).then(() => {
        const html = render(
          <Provider store={store} key="provider">
            <StaticRouter location={location} context={reactRouterContext}>
              <RouteDispatcher routes={routes} />
            </StaticRouter>
          </Provider>
        );

        expect(html.text()).toContain('I do not use @asyncConnect');
        testState = store.getState();
        expect(testState.routeDispatcher.loaded).toBe(true);
        expect(testState.routeDispatcher.loadState[location]).toBe(undefined);

        // global loader spy
        expect(endGlobalLoadSpy.called).toBe(false);
        expect(beginGlobalLoadSpy.called).toBe(false);

        resolve();
      });
    });
  });

  it('fetches data on the server when using immutable data structures', function test() {
    // We use a special reducer built for handling immutable js data
    const immutableDataReducer = function wrapReducer(immutableState, action) {
      return createImmutableReducer(testDataReducer, immutableState, action);
    };

    const immutableReducers = combineImmutableReducers({
      routeDispatcher: immutableReducer,
      testData: immutableDataReducer,
    });

    // We need to re-wrap the component so the mapStateToProps expects immutable js data
    const ImmutableWrappedApp = connectDispatcher(
    ({ dispatch }) => dispatch(mockAsyncActionSpy('desert')),
    state => ({
      value: state.getIn(['testData', 'value']),
    }))(ContentComponent);

    const immutableRoutes = [
      { component: RootComponent,
        routes: [
          { path: '/immutable',
            exact: true,
            component: ImmutableWrappedApp,
          },
          { path: '/notconnected',
            component: RegularComponent,
          },
        ],
      },
    ];

    // Set the mutability/immutability functions
    setToImmutableStateFunc(mutableState => Immutable.fromJS(mutableState));
    setToMutableStateFunc(immutableState => immutableState.toJS());

    return new Promise((resolve) => {
      // Create the store with initial immutable data
      const store = createStore(immutableReducers, Immutable.Map({}), applyMiddleware(thunk));
      const reactRouterContext = {};
      const location = '/immutable';

      dispatchOnServer(store, immutableRoutes, location, {}).then(() => {
        const html = render(
          <Provider store={store} key="provider">
            <StaticRouter location={location} context={reactRouterContext}>
              <RouteDispatcher routes={immutableRoutes} />
            </StaticRouter>
          </Provider>
        );

        expect(html.text()).toContain('desert');
        testState = store.getState().toJS();  // convert to plain js for assertions
        expect(testState.routeDispatcher.loaded).toBe(true);
        expect(testState.routeDispatcher.loadState[location].loading).toBe(false);
        expect(testState.routeDispatcher.loadState[location].loaded).toBe(true);
        expect(testState.routeDispatcher.loadState[location].error).toBe(null);

        // global loader spy
        expect(endGlobalLoadSpy.called).toBe(false);
        expect(beginGlobalLoadSpy.called).toBe(false);

        resolve();
      });
    });
  });
});
