import { matchRoutes } from 'react-router-config';
import { endGlobalLoad } from '../store';

export const STATIC_ASYNC_METHOD = 'asyncDispatcher';

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
export function invokeAsyncDispatchers(routes, store, location, helpers) {
  const branch = matchRoutes(routes, location);
  const promises = branch.map(({ route, match }) => {
    if (route.component[STATIC_ASYNC_METHOD]) {
      return route.component[STATIC_ASYNC_METHOD](store, match, helpers);
    }

    return null;
  }).filter(p => p !== null);

  if (promises.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(promises);
}

/**
 * Helper to load data on server
 * @param  {Array} routes
 * @param  {Object} store
 * @param  {string} location
 * @param  {Object} helpers utilities for dispatching actions
 * @return {Promise}
 */
export function loadOnServer(routes, store, location, helpers) {
  return invokeAsyncDispatchers(routes, store, location, helpers).then(() => {
    store.dispatch(endGlobalLoad());
  });
}
