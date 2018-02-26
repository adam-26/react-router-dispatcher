# react-router-dispatcher

[![Greenkeeper badge](https://badges.greenkeeper.io/adam-26/react-router-dispatcher.svg)](https://greenkeeper.io/)
[![npm](https://img.shields.io/npm/v/react-router-dispatcher.svg)](https://www.npmjs.com/package/react-router-dispatcher)
[![npm](https://img.shields.io/npm/dm/react-router-dispatcher.svg)](https://www.npmjs.com/package/react-router-dispatcher)
[![CircleCI branch](https://img.shields.io/circleci/project/github/adam-26/react-router-dispatcher/master.svg)](https://circleci.com/gh/adam-26/react-router-dispatcher/tree/master)
[![Code Climate](https://img.shields.io/codeclimate/coverage/github/adam-26/react-router-dispatcher.svg)](https://codeclimate.com/github/adam-26/react-router-dispatcher)
[![Code Climate](https://img.shields.io/codeclimate/github/adam-26/react-router-dispatcher.svg)](https://codeclimate.com/github/adam-26/react-router-dispatcher)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)

react-router-dispatcher is designed to work with [react-router v4.x](https://github.com/ReactTraining/react-router), it:
  * uses _actions_ to encapsulate behaviors
  * supports server-side rendering, including resolving async promises before rendering
  * requires using [react-router-config v4.x](https://github.com/ReactTraining/react-router/tree/master/packages/react-router-config) route configuration

#### Looking for **version 1.x**??
>[You can find it on the _V1_ branch](https://github.com/adam-26/react-router-dispatcher/tree/v1).
Version 2 has been simplified and **no longer requires [redux](redux.js.org)**

## Install
```sh
// npm
npm install --save react-router-dispatcher

// yarn
yarn add react-router-dispatcher
```

## Available actions

  * [react-router-dispatcher-status-code](https://github.com/adam-26/react-router-dispatcher-status-code) set HTTP status code of streaming responses
  * [react-router-dispatcher-redirect](https://github.com/adam-26/react-router-dispatcher-redirect) redirect routes that support SSR streams by redirecting before render
  * [react-router-dispatcher-metadata](https://github.com/adam-26/react-router-dispatcher-metadata) SSR stream supported HTML metadata

## Usage

#### Universal rendering

If your building a universal application, use the `createRouteDispatchers` factory method.

```js
// dispatcher.js
import { createRouteDispatchers } from 'react-router-dispatcher';
import { LOAD_METADATA } from 'react-router-metadata-action';
import { LOAD_DATA } from './loadDataAction';

// === route dispatcher configuration ===
// 1. define react-router-config route configuration
const routes = [...];

// 2. define the ORDER that actions are invoked
const orderedActionNames = [[LOAD_DATA], [LOAD_METADATA]];

// Use the createRouteDispatchers factory,
// it returns everything required for rendering dispatcher actions
const {
  UniversalRouteDispatcher,
  ClientRouteDispatcher,
  dispatchClientActions,
  dispatchServerActions
} = createRouteDispatchers(routes, orderedActionNames /*, options */);
```

##### server-side rendering
```js
import Html from 'react-html-metadata';
import { dispatchServerActions, UniversalRouteDispatcher } from './dispatcher';
import apiClient from './someOtherPackage';

const location = request.url; // current request URL, from expressjs or similar
const actionParams = { apiClient }; // passed to all dispatch action methods

dispatchServerActions(location, actionParams /*, options */).then(({ metadata, store }) => {
  const staticRouterCtx = {};

  // Render the response, supports rendering to stream and string
  const stream = renderToNodeStream(
    <Html metadata={metadata}>
      <StaticRouter location={location} context={staticRouterCtx}>
        <UniversalRouteDispatcher appData={store} />
      </StaticRouter>
    </Html>);

  res.write("<!DOCTYPE html>");
  stream.pipe(res);
});
```

##### client-side rendering
```js
import { hydrate, render } from 'react-dom';
import Html from 'react-html-metadata';
import {
  dispatchClientActions,
  UniversalRouteDispatcher,
  ClientRouteDispatcher
} from './dispatcher';

const location = window.location.pathname; // current url, from browser window
const appData = window.__AppData; // data serialized from the server render

// This is synchronous
// It uses the appData to recreate the metadata on the client
const { metadata } = dispatchClientActions(location, appData);

// Use hydrate() with server-side rendering,
// otherwise use render() with <ClientRouteDispatcher />
hydrate(
  <Html metadata={metadata}>
    <BrowserRouter>
  	  <UniversalRouteDispatcher />
    </BrowserRouter>
  </Html>
);
```

#### client-only rendering

For the client app, use the exported `<RouteDispatcher>` component to render your application.

```js
import { RouterDispatcher } from 'react-router-dispatcher';

const routeCfg = []; // same as server (react-router-config routes)

// render your app
<Router ...>
	<RouterDispatcher routes={routeCfg} actionNames={[['loadData']]} />
</Router>

```

### Actions

>You **must assign actions to route components** (components that are assigned directly to react-router-config style routes)

#### Define an _action_

Packages that support _react-router-dispatcher_ should export _actions_.

```js
// loadDataAction.js - a simple action for loading async data
import getDisplayName from 'react-display-name';

export const LOAD_DATA = 'LOAD_DATA_ACTION';

export default function loadDataAction(paramsToProps = () => {}) {
  return {
    name: LOAD_DATA,
    staticMethodName: 'loadData',
    initServerAction: (params) => ({
      store: params.store || {}
    }),
    mapParamsToProps: (params, routerCtx) => {
      store: params.store,
      ...paramsToProps(params, routerCtx)
    }
  };
}
```

#### Applying actions to components

```js
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withActions } from 'react-router-dispatcher';
import loadDataAction from './loadDataAction';

class ExampleComponent extends Component {
  static propTypes = {
    store:     PropTypes.object.isRequired,
    apiClient: PropTypes.object.isRequired
  };

  // loadDataAction invokes this method to load data from an api
  static loadData(routeProps, actionProps, routerCtx) {
    const { location, match: { params } } = routeProps;
    const { store, apiClient } = actionProps;

    // async functions must return a Promise
    return apiClient.loadById(params.id).then((data) => {
      store.exampleData = data;
    });
  }

  render() {
    const {store: { exampleData }} = this.props;
    return <div>{exampleData}</div>
  }
}

// the mapper must return the 'propTypes' expected by the component
const mapParamsToProps = ({ apiClient }) => { apiClient };
export default withActions(loadDataAction(mapParamsToProps))(ExampleComponent);

```

## API

### Actions

It's _recommended_ that all actions are defined as factory _functions_ that return new action instances.
It can be useful to allow actions to accept parameters to customize the actions behavior.

#### Action Schema

**name**: `string`
  * **required**
  * The action name should also be exported as a `string`, to be used for configuring action order

**staticMethod**: `(routeProps, actionProps, routerCtx) => any`
  * One of `staticMethod` **or** `staticMethodName` is **required**
  * Action method implementation, can be defined here or using static methods on components actions are assigned to
  * return a `Promise` for **async** actions
  * for non-async actions, return data

**staticMethodName**: `string`
  * One of `staticMethod` **or** `staticMethodName` is **required**
  * the name of the static method _required_ on any `Component` that the action is applied to

**mapParamsToProps**: `(params, routerCtx) => Object`
  * **required**
  * maps `actionParams` to component props
  * this method **must** map params to the Components configured `propTypes`

**hoc**: `(Component) => node`
  * Optional
  * Defines a higher-order component that is applied to _all_ components that have the action assigned
  * Using higher-order components makes actions very versatile!

**initServerAction**: `(actionParams) => Object`
  * Optional, but **required** if the action supports being invoked on the server **before rendering**
  * if your action supports server-side usage but does not need to perform any init, return an **empty** object
    * `initServerAction: (params) => {}`

**initClientAction**: `(actionParams) => Object`
  * Optional, but **required** if the action supports being invoked on the client **before rendering**
  * if your action supports client-side usage but does not need to perform any init, return an **empty** object
    * `initClientAction: (params) => {}`

**successHandler**: `({location}, params) => void`
  * Optional, invoked after this action is successfully invoked on each matching route
  * Params will include any value(s) assigned from the static action methods
  * NOTE: `params` are the _raw_ dispatcher parameters

**errorHandler**: `({location}, err) => void`
  * Optional, invoked if any static action methods or success handler fails

**stopServerActions**: `(routeProps, actionProps, routerCtx) => boolean`
  * Optional, allows an action to short-circuit/prevent invocation of following action sets with `dispatchOnServer()`
    * For example; An action may determine a redirect is required, therefore invoking following action sets is a waste of resources

### Methods

#### `createRouteDispatchers(routes, orderedActionNames, options)`

**routes**: `Array`
  * Routes defined using the [react-router-config](https://github.com/ReactTraining/react-router/tree/master/packages/react-router-config) format.

**orderedActionNames**: `string | Array<string> | Array<Array<string>> | (location, actionParams) => string|Array<string>|Array<Array<string>>`
  * Configures the **order** that actions will be executed
  * A `string` can be used if only 1 action is used
  * An array of action names will execute all actions in **parallel**
  * A nested array enables actions to be executed **serially**
    * ie: `[['loadData'], ['parseData']]` first `loadData` is invoked on **each component**, then `parseData` is invoked on each component
  * A function, `dispatchActions(location, actionParams)`. Return one of the previously defined types (string, array, nested array).

**options**: `Object`
  * routeComponentPropNames: `Array<string>`, route prop name(s) that are known to be react components
  * loadingIndicator: `React Component`, a component to display for client-side renders when loading async data

#### `withActions(actions)`

A higher-order component function for assigned actions to components

**actions**:
  * one or more actions to be applied to a react component
  * separate multiple actions using a comma: `withActions(loadData(), parseData())(Component)`

### Components

#### `<RouteDispatcher>` component

Props:

**routes**: `Array`
  * Routes defined using the [react-router-config](https://github.com/ReactTraining/react-router/tree/master/packages/react-router-config) format.

**actionNames**: `string | Array<string> | Array<Array<string>> | (location, actionParams) => string|Array<string>|Array<Array<string>>`
  * Configure the **action(s)** defined any any _route component_ to invoke before rendering.
  * See [createRouteDispatchers.orderedActionNames for more information](https://github.com/adam-26/react-router-dispatcher#API)

**routeComponentPropNames**: `Array<string>`
  * The **prop** names of _route components_ that are known to be react **components**
  * The default value is `component`.

**actionParams**: `any`
  * Any value can be assigned to the action params, the value is passed to all **action methods**, common usages include passing api clients and application state (such as a redux store)

**loadingIndicator**: `React Component`
  * A custom component to display on the client when async actions are pending completion
  * **note**: this is only rendered on the client

**render**: `(routes, routeProps) => node`
  * A custom render method
  * you **must** invoke the react-router `renderRoutes` method within the render method

### Utilities

#### defineRoutes

The `defineRoutes` utility method automatically assigns `keys` to routes that don't have a key manually assigned.
This key can be accessed from **actions** to determine the exact route that is responsible for invoking the action.

```js
import { defineRoutes } from 'react-router-dispatcher';

const routes = defineRoutes([
	// define react-router-config routes here
]);
```

#### matchRouteComponents

Resolves all route components for a requested location and a given set of routes.

```js
import { matchRouteComponents } from 'react-router-dispatcher';

const matchedRoutes = matchRouteComponents(location, routes, routeComponentPropNames);
const [component, match, routerContext] = matchedRoutes[0];
const { route, routeComponentKey } = routerContext;
```


### Contribute
For questions or issues, please [open an issue](https://github.com/adam-26/react-router-dispatcher/issues), and you're welcome to submit a PR for bug fixes and feature requests.

Before submitting a PR, ensure you run `npm test` to verify that your coe adheres to the configured lint rules and passes all tests. Be sure to include unit tests for any code changes or additions.

## License
MIT
