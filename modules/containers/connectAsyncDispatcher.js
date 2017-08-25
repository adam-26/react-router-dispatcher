import { connect } from 'react-redux';
import { isPromise, STATIC_ASYNC_METHOD } from '../helpers/utils';
import { load, loadFail, loadSuccess } from '../store';

// NOTE: async-redux-route-dispatcher
// NOTE: The asyncDispatcher should ONLY dispatch actions using redux middleware
// NOTE: Because the asyncDispatcher will exec before mapStateToProps is invoked,
//       use standard redux approach

function wrapDispatcher(dispatcher) {
  return (store, match, helpers) => {
    const { dispatch } = store;

    const key = match.url;
    const result = dispatcher(store, match, helpers);
    if (isPromise(result)) {
      dispatch(load(key));
      // add action dispatchers
      return result
          .then(data => dispatch(loadSuccess(key, data)))
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
 * @param  {Function} asyncDispatcher
 * @param  {Function} [mapStateToProps]
 * @param  {Object|Function} [mapDispatchToProps]
 * @param  {Function} [mergeProps]
 * @param  {Object} [options]
 * @return {Function}
 */
export function connectAsyncDispatcher(
  asyncDispatcher,
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  options) {
  return (Component) => {
    Component[STATIC_ASYNC_METHOD] = wrapDispatcher(asyncDispatcher);
    return connect(mapStateToProps, mapDispatchToProps, mergeProps, options)(Component);
  };
}

// convenience export
export default connectAsyncDispatcher;
