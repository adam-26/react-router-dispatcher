// @Flow
import { connect } from 'react-redux';
import RouteDispatcherComponent from '../components/RouteDispatcherComponent';
import { beginGlobalLoad, endGlobalLoad } from '../store';

const mapStateToProps = (state, ownProps: { routerReducerName?: string }) => {
  const { location } = state[ownProps.routerReducerName || 'router'] || {};
  return {
    location,
  };
};

// for testing
export function createRouteDispatcher(beginGlobalLoadFn, endGlobalLoadFn) {
  // todo: withRouter() instead of 'mapStateToProps'?
  return connect(
    mapStateToProps, {
      beginGlobalLoad: beginGlobalLoadFn,
      endGlobalLoad: endGlobalLoadFn,
    })(RouteDispatcherComponent);
}

export default createRouteDispatcher(beginGlobalLoad, endGlobalLoad);
