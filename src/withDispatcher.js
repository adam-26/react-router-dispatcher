import { connect } from 'react-redux';
import invariant from 'invariant';
import { isPromise, STATIC_DISPATCHER_METHOD } from './utils';
import { load, loadFail, loadSuccess } from './store';

function wrapDispatcher(dispatcher) {
  return (store, match, helpers = {}) => {
    const { dispatch } = store;

    const key = match.url;
    const result = dispatcher(store, match, helpers);
    if (isPromise(result)) {
      dispatch(load(key));

      return result
          .then(() => dispatch(loadSuccess(key)))
          .catch(err => dispatch(loadFail(key, err)));
    }

    if (result) {
      return dispatch(loadSuccess(key, result));
    }

    return Promise.resolve();
  };
}

/**
 * Assigns the async dispatcher to the component, and connects to the redux store at the same time
 * @param  {Function} dispatcher
 * @return {Function}
 */
export default function withDispatcher(dispatcher) {
  return (Component) => {
    invariant(Component, '`withDispatcher()` requires a Component.');
    invariant(dispatcher, '`withDispatcher()` requires a dispatcher function argument.');

    Component[STATIC_DISPATCHER_METHOD] = wrapDispatcher(dispatcher);
    return Component;
  };
}

/**
 * Assigns the async dispatcher to the component, and connects to the redux store at the same time
 * @param  {Function} dispatcher
 * @param  {Function} [mapStateToProps]
 * @param  {Object|Function} [mapDispatchToProps]
 * @param  {Function} [mergeProps]
 * @param  {Object} [options]
 * @return {Function}
 */
export function connectDispatcher(
  dispatcher,
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  options) {
  return Component =>
    connect(mapStateToProps, mapDispatchToProps, mergeProps, options)(
      withDispatcher(dispatcher)(Component)
    );
}
