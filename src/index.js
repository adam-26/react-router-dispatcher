import RouteDispatchManager from './containers/RouteDispatcher';
import withDispatcher, { connectDispatcher } from './withDispatcher';

export routeContainer from './routeContainer';
export dispatchOnServer from './dispatchOnServer';
export { reducer, immutableReducer } from './store';
export { setToImmutableStateFunc, setToMutableStateFunc } from './state';
export {
    withDispatcher,
    connectDispatcher,
    RouteDispatchManager
};
export default RouteDispatchManager;
