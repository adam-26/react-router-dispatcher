# react-router-dispatcher
-------
Enables async data to be loaded using redux _before_ react rendering on both **server** and **client** environments, using:
 * [react](https://facebook.github.io/react/)
 * [redux](http://redux.js.org/)
 * [react-redux](https://github.com/reactjs/react-redux)
 * [react-router v4.x](https://reacttraining.com/react-router/web/api/location)

Supports:
 * [redux-thunk](https://github.com/gaearon/redux-thunk)
 * [redux-saga](https://redux-saga.js.org)

##### Install
Install using NPM:

```
npm install --save react-router-dispatcher
```

Install using Yarn:

```
yarn install react-router-dispatcher
```


### Introduction

This package uses redux _route actions_ to load (async) data on the server and client, it has been tested using _redux-thunk_ and _redux-saga_. This approach maintains consistancy across your project.

> for documentation purposes, we define a **route action** to be a redux action that is responsible for loading the data required to render a specific route.

Its recommended that the _route actions_ **only** dispatch other actions that are required for a route to render.

Unlike some other [react-router v4.x](https://reacttraining.com/react-router/web) server-side rendering solutions (such as [react-jobs](https://github.com/ctrlplusb/react-jobs)), this package does **not** perform a "pre-render parse", it performs only a **single render** per request. It achieves this using the `react-router-config` package to enable server-side rendering.

**Important:** this restricts _how_ you define the routes for your application. You **must** define routes using the react-router _config_ format, **not** using `<Route />` components.


Here is an example react-router v4.x route configuration:
```js
const routes = [{
  component: RootComponent,
  routes: [{
    path: '/',
    exact: true,
    component: AppComponent,
    routes: [{
      path: '/account',
      exact: true,
      component: AccountComponent
    }]
  }]
}];
```

> For documentation purposes, we will define a **RouteComponent** to be any react component used in the route configuration. Only **RouteComponent**'s can initiate dispatch actions to load data for rendering.

> In the above example, RootComponent, AppComponent and AccountComponent are all considered **RouteCommponet**'s for documentation purposes.

At first, this may sound restrictive so it's _important_ to understand that a RouteComponent can invoke `routeDispatcher` methods of child components.

### Quickstart
_The quickstart assumes you are very familar with react, redux and react-router_

Use the `withDispatcher` method to assign a _route dispatcher_ to a RouteComponent:
```js
import { withDispatcher } from 'react-router-dispatcher';

// parameters: (redux store, react-router match, optional helpers)
export default withDispatcher(({dispatch}, {params}) => {

  // You MUST return the dispatch response
  // use the route parameters to dispatch a route action that will load all the data required for this request
  return dispatch(routeAction(params.urlValue));

})(RouteComponent);

```

It's recommended that `withDispatcher` dispatch actions using _redux middleware_.

Because `withDispatcher` is invoked before the RouteComponent is rendered, the standard redux `mapStateToProps` can be used by the RouteComponent to configure access to the required data from the redux store.

Then, configure your application to use the `RouteDispatcher` component:

```js
import Provider from 'redux';
import { StaticRouter } from 'react-router';
import RouteDispatcher from 'react-router-dispatcher';

export default class AppComponent extends React.Component {

  // propTypes, etc...

  render() {
    const {store, routes, location} = this.props;
    return (
      <RouteDispatcher routes={routes} />
    );
  }
}
```

The `RouteDispatcher` will ensure all RouteComponent dispatchers are processed before rendering.

Configure the client to render the app using react-router-redux `ConnectedRouter`, it uses redux to maintain router state:

```js
// client.js
import React from 'react';
import { render } from 'react-dom';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { ConnectedRouter, routerMiddleware } from 'react-router-redux';
import RouteDispatcher from 'react-router-dispatcher';
import createBrowserHistory from 'history/createBrowserHistory';
import routes from '...';

const history = createBrowserHistory();
const supportsHistory = 'pushState' in window.history;
// ...create redux store - be sure to include 'routerMiddleware'
const store = createStore(...);

const clientApp = (
  <Provider store={store}>
    <ConnectedRouter history={history} forceRefresh={!supportsHistory}>
      <RouteDispatcher routes={routes} />
    </ConnectedRouter>
  </Provider>
);

render(clientApp, htmlElement);
```

Render the `App` on the server using react-routers `StaticRouter`:

```js
// server.js - expressjs example
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { routerMiddleware } from 'react-router-redux';
import RouteDispatcher, { dispatchOnServer } from 'react-router-dispatcher';
import routes from '...';

app.use('*', (request, response) => {

  // create redux store - add reducers, middleware
  // be sure to include 'routerMiddleware'
  const store = createStore(...);
  const location = request.url;

  const serverApp = (
    <Provider store={store}>
      <StaticRouter location={location} context={reactRouterContext}>
        <RouteDispatcher routes={routes} />
      </StaticRouter>
    </Provider>
  );

  dispatchOnServer(store, routes, location).then(() => {

    const renderedApp = renderToString(serverApp);
    const html = renderToStaticMarkup(`<html><body>${renderedApp}</body></html>`);
    response.status(200).send(`<!DOCTYPE html>${html}`);
  });
});
```

##### A note about caching data
No cache management should be done with route dispatchers. All configured actions will be dispatched for each route request. The **redux actions** using redux middleware should implement caching if its required

#### Route Containers

A `routeContainer()` HOC method is included in the package that allows you to easily assign different components to render based on the current state of a RouteComponent:

```js
import { routeContainer } from 'react-router-dispatcher';

const RouteContainer = routeContainer({
  onLoad: () => (<div>loading...</div>),
  onError: ({ error }) => (<div>{error}</div>),
})(RouteComponent);
```
It's important to understand that a `RouteContainer` should **only** be used like a RouteComponent. A RouteContainer will **not render correctly** if its not used within a route configuration.

### Advanced Usage

Server-side rendering using _redux-saga_:

```js
// #1. Run the root saga
const sagaPromise = sagaMiddleware.run(rootSaga);

// #2. Invoke all route dispatchers to run sagas
dispatchOnServer(store, routes, location, {}).then(() => {

  // #3. Inform saga that all actions have been dispatched
  store.dispatch(END);

  // #4. Render after the saga promise is done
  sagaPromise.done.then(() => {
    render(<App store={store} routes={routes} location={location} />, htmlElement);
  });
});
```

Dispatching multiple actions:
```js
// You can dispatch mulitple actions using Promise.all()
export default withDispatcher(({dispatch}, {params}) => {
  return Promise.all([
    dispatch(reduxAction(params.urlValue)),
    dispatch(otherAction(params.anotherUrlValue))
  ]);
})(RouteComponent);
```

Dispatching child component a RouteComponent `routeDispatcher`:

```js
import { Component } from 'react';
import Header from './HeaderComponent';
import Catalogue from './CatalogueComponent';
import Footer from './FooterComponent';

class CatalogueRouteComponent extends Component {

  render() {
    return (
      <div>
        <Header>
        <Catalogue>
        <Footer>
      </div>
    );
  }
}

export default withDispatcher((store, match) => {
  return Promise.all([
    Header.routeDispacther(store, match),
    Catalogue.routeDispacther(store, match)
  ]);
})(CatalogueComponent);

```

## API

_NOTE: The API documentation still needs a lot of improvement._

#### withDispatcher()

Assigns a dispatcher to a RouteComponent

> HOC

```js
import { withDispather } from 'react-router-dispatcher';

type RouteDispatcher = ((reduxStore: Object, match: Object, helpers?: Object)): mixed;

withDispather(routeDispatcher: RouteDispatcher):
```

> ES7 Decorator
>
> Requires [babel plugin transform-decorators](https://babeljs.io/docs/plugins/transform-decorators/)

```js
@withDispather(routeDispatcher: RouteDispatcher)
export default class RouteComponent extends Component {
  // ...
}
```

#### connectDispatcher()

Assigns a dispatcher to a RouteComponent and connect to the redux store. This is a utility method that enables you to assign a dispatcher and configure the redux store in a single command.

see [react-redux](https://github.com/reactjs/react-redux) for more information about the `connect` parameters.

```js
import { connectDispatcher } from 'react-router-dispatcher';

connectDispather(routeDispatcher: RouteDispatcher, [mapPropsToStore], [mapDispatchToProps], [mergeProps], [options]):
```

#### dispatchOnServer()

Dispatch all route actions for a server render

```js
import { dispatchOnServer } from 'react-router-dispatcher';

dispatchOnServer(store: Object, routes: Array, location: string, helpers?: Object): Promise;
```

#### &lt;RouteDispatcher /&gt;
Synchronizes state between server and client rendering, and invokes dispatchers on the client when required.

```js
import RouteDispatcher from 'react-router-dispatcher';

<RouteDispatcher routes={} helpers={{}} />
```


## Usage with `ImmutableJS`

This lib can be used with ImmutableJS or any other immutability lib by providing methods that convert the state between mutable and immutable data. Along with those methods, there is also a special immutable reducer that needs to be used instead of the normal reducer.

```js
import { setToImmutableStateFunc, setToMutableStateFunc, immutableReducer as routeDispatcherReducer } from 'react-router-dispatcher';

// Set the mutability/immutability functions
setToImmutableStateFunc((mutableState) => Immutable.fromJS(mutableState));
setToMutableStateFunc((immutableState) => immutableState.toJS());

// Thats all, now just use redux-connect as normal
export const rootReducer = combineReducers({
  routeDispatcher: routeDispatcherReducer,
  ...
})
```

**React Router Issue**

While using the above immutablejs solution, an issue arose causing infinite recursion after firing
off a react standard action. The recursion was caused because the `componentWillReceiveProps` method will attempt to resync with the server. Thus `componentWillReceiveProps -> resync with server -> changes props via reducer -> componentWillReceiveProps`

The solution was to only resync with server on route changes. A `reloadOnPropsChange` prop is expose on the ReduxAsyncConnect component to allow customization of when a resync to the server should occur.

Method signature `(props, nextProps) => bool`

```js
const reloadOnPropsChange = (props, nextProps) => {
  // reload only when path/route has changed
  return props.location.pathname !== nextProps.location.pathname;
};

export const Root = ({ store, history }) => (
<Provider store={store}>
  <StaticRouter location={location}>
    <RouteDispatcher routes={routes} reloadOnPropsChange={reloadOnPropsChange} />
  </StaticRouter>
</Provider>
);
```

### Contribute
For questions or issues, please [open an issue](https://github.com/adam-26/react-router-dispatcher/issues), and you're welcome to submit a PR for bug fixes and feature requests.


### Notice

This is a fork and major refactor of [redux-connect](https://github.com/makeomatic/redux-connect), that is a fork of [redux-async-connect](https://github.com/Rezonans/redux-async-connect). It also incorporates ideas from [this react + redux boilerplate](https://github.com/CrocoDillon/universal-react-redux-boilerplate), it makes for a great starter kit - its clean and simple.


## License
MIT
