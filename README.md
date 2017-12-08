# react-router-dispatcher

[![npm](https://img.shields.io/npm/v/react-router-dispatcher.svg)](https://www.npmjs.com/package/react-router-dispatcher)
[![npm](https://img.shields.io/npm/dm/react-router-dispatcher.svg)](https://www.npmjs.com/package/react-router-dispatcher)
[![CircleCI branch](https://img.shields.io/circleci/project/github/adam-26/react-router-dispatcher/master.svg)](https://circleci.com/gh/adam-26/react-router-dispatcher/tree/master)
[![Code Climate](https://img.shields.io/codeclimate/coverage/github/adam-26/react-router-dispatcher.svg)](https://codeclimate.com/github/adam-26/react-router-dispatcher)
[![Code Climate](https://img.shields.io/codeclimate/github/adam-26/react-router-dispatcher.svg)](https://codeclimate.com/github/adam-26/react-router-dispatcher)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)

react-router-dispatcher is designed to work with [react-router v4.x](https://github.com/ReactTraining/react-router), it:
  * invokes static methods of _route components_ before rendering
  * requires using [react-router-config v4.x](https://github.com/ReactTraining/react-router/tree/master/packages/react-router-config) route configuration
  * supports server-side rendering.

#### Looking for **version 1.x**??
>[You can find it on the _V1_ branch](https://github.com/adam-26/react-router-dispatcher/tree/v1).
Version 2 has been simplified and **no longer requires [redux](redux.js.org)**


### Install
```sh
// npm
npm install --save react-router-dispatcher

// yarn
yarn add react-router-dispatcher
```

### Usage

##### server-side rendering

If your building a universal application, use the `createRouteDispatchers` factory method to
create the `<UniversalRouteDispatcher>` component to render routes on **both client and server**.

```js
import { createRouteDispatchers } from 'react-router-dispatcher';

// === route dispatcher configuration ===
const routes = [...]; // react-router-config configuration
const options = {
  dispatchActions: [['loadData']] // static methods to invoke
};

// Use the createRouteDispatchers factory, it returns a component and method for server-side rendering
const { UniversalRouteDispatcher, dispatchOnServer } = createRouteDispatchers(routes, options);

// === server-side render params ===
const location = request.url; // current request URL
const actionParams = { apiClient }; // passed to all dispatch action methods

dispatchOnServer(location, actionParams /*, options */).then(() => {
  // render your application here
  // Use the <UniversalRouteDispatcher /> component created by the factory method to render your app
});

```

##### client rendering

For the client app, use the exported `<RouteDispatcher>` component to render your application.

```js
import { RouterDispatcher } from 'react-router-dispatcher';

const routeCfg = []; // same as server (react-router-config routes)

// render your app
<Router ...>
	<RouterDispatcher routes={routeCfg} dispatchActions={[['loadData']]} />
</Router>

```

**Alternatively**, the `createRouteDispatchers()` factory also returns a `ClientRouteDispatcher`.
> This can be useful for **conditional** client _render_ **or** _hydrate_

```js
import { createRouteDispatchers } from 'react-router-dispatcher';

const { ClientRouteDispatcher } = createRouteDispatchers(routes, options);
```

### Defining actions

>You **must define actions on route components** (components that are assigned directly to react-router-config style routes)

An action is simply a **static method** defined on a component. Its _recommended_ that you return a **Promise** from the static action method.

```js
export default class MyComponent extents React.Component {

  static loadData = (routeProps, actionParams, routerCtx) => {
    const { location, match } = routeProps;
    const {params, isExact, path, url} = match; // match from react-router
    
    const { route, routeComponentKey } = routerCtx;
    
    return Promise.resolve(actionParams.api.loadData(params.id));
  };

  // ...render, etc.
}
```

The same can be achieved using stateless components

```js
const MyComponent = (props) => {
	// render here
};

MyComponent.loadData = (match, actionParams) => {
	return Promise.resolve(actionParams.api.loadData(match.params.id));
};
```

### Configuration options

##### `dispatchActions`
Configure the **static method(s)** defined any any _route component_ to invoke before rendering.
Accepts:
  * a string, the default is `loadData` - any component with a `static loadData = (routeProps, actionParams, routerCtx) => {}` will be invoked before rendering
  * an array, `['loadData', 'parseData']` - all methods will be invoked in parallel before rendering
  * nested array, `[['loadData'], ['parseData']]` - each inner array will be invoked serially (ie: `loadData` will be invoked on all components, before `parseData` is invoked on all components)
  * a function, `dispatchActions(location, actionParams)`. Return one of the previously defined types (string, array, nested array).

##### `routeComponentPropNames`
Configure the **prop** names of _route components_ that are known to be react **components**
The default value is `component`.

##### `actionParams`
Any value can be assigned to the params, the value is passed to all **static action methods**, common usages include passing api clients and application state (such as a redux store)

### RouteDispatcher Props

>All configuration options can be assigned as props

##### `loadingIndicator`
If server-side rendering is **not** used, a _loading component_ will be displayed to the user when dispatching actions on initial load. Pass a component to customize the loading UI.

##### `render`
Allows the render method to be customized, you **must** invoke the react-router `renderRoutes` method within the render method.

### Utilities

#### defineRoutes

The `defineRoutes` utility method automatically assigns `keys` to routes that don't have a key manually assigned.
This key can be accessed from **dispatch actions** to determine the route that is responsible for invoking the action.

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
