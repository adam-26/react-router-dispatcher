// @flow
import { invokeRouteDispatchers } from './utils';
import { beginGlobalLoad, endGlobalLoad } from './store';

/**
 * Helper to load data on server
 * @param  {Object} store
 * @param  {Array} routes
 * @param  {string} location
 * @param  {Object} helpers utilities for dispatching actions
 * @return {Promise}
 */
export default function dispatchOnServer(
  store: Object,
  routes: Array,
  location: string,
  helpers?: mixed) {
  store.dispatch(beginGlobalLoad());
  return invokeRouteDispatchers(store, routes, location, helpers).then(() => {
    store.dispatch(endGlobalLoad());
  });
}
