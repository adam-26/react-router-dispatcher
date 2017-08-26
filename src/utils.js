// @Flow
import { matchRoutes } from 'react-router-config';

export const STATIC_DISPATCHER_METHOD = 'routeDispatcher';

export const REDUCER_NAME = 'routeDispatcher';

/**
 * Tells us if input looks like promise or not
 * @param  {Mixed} obj
 * @return {Boolean}
 */
export function isPromise(obj) {
  return typeof obj === 'object' && obj && obj.then instanceof Function;
}

/**
 * Function that accepts components with reduxAsyncConnect definitions
 * and loads data
 * @param  {Array} routes
 * @param  {Object} store
 * @param  {string} location
 * @param  {Object} helpers utilities for dispatching actions
 * @return {Promise}
 */
export function invokeRouteDispatchers(
  store: Object,
  routes: Array,
  location: string,
  helpers?: mixed) {
  const branch = matchRoutes(routes, location);
  const promises = branch.map(({ route, match }) => {
    if (route.component[STATIC_DISPATCHER_METHOD]) {
      return route.component[STATIC_DISPATCHER_METHOD](store, match, helpers);
    }

    return null;
  }).filter(p => p !== null);

  if (promises.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(promises);
}
