import { Component } from 'react';
import invariant from 'invariant';
import PropTypes from 'prop-types';
import { renderRoutes } from 'react-router-config';
import { invokeRouteDispatchers, REDUCER_NAME } from '../utils';
import { getMutableState } from '../state';

function getRoutePathAndQuery(location, router) {
  // location is populated from the redux store, however on initial render
  // the router store may be empty, grab the location from the router context
  const locationSource = location || (router.route && router.route.location);
  invariant(locationSource, '<RouteDispatcher /> has not been assigned a location');
  return `${locationSource.pathname}${locationSource.search}${locationSource.hash}`;
}

function filterPropsToState(props, ctx) {
  const { location } = props;
  const { router } = ctx;
  return {
    // may need to include 'routes' from props as state?
    // if routes are dynamically assigned, this is probably required for render()
    pathAndQuery: getRoutePathAndQuery(location, router),
  };
}

export default class RouteDispatcherComponent extends Component {
  static propTypes = {
    render: PropTypes.func.isRequired,
    reloadOnPropsChange: PropTypes.func,
    /* eslint-disable react/forbid-prop-types, react/no-unused-prop-types */
    beginGlobalLoad: PropTypes.func.isRequired,
    endGlobalLoad: PropTypes.func.isRequired,
    reducerName: PropTypes.string,
    helpers: PropTypes.any,
    routes: PropTypes.array.isRequired,
    location: PropTypes.object,
    /* eslint-enable */
  };

  static contextTypes = {
    store: PropTypes.object.isRequired,
    router: PropTypes.shape({
      route: PropTypes.shape({
        location: PropTypes.object,
      }),
    }).isRequired,
  };

  static defaultProps = {
    helpers: {},
    location: null,
    reducerName: REDUCER_NAME,
    reloadOnPropsChange({ location }, { router }) {
      return this.state.pathAndQuery !== getRoutePathAndQuery(location, router);
    },
    render(routes) {
      return renderRoutes(routes);
    },
  };

  constructor(props, context) {
    super(props, context);
    this.state = this.isLoaded() ? filterPropsToState(props, context) : {};

    this.mounted = false;
    this.currentLocation = null;
    this.globalLoadCounter = 0;
  }

  componentDidMount() {
    this.mounted = true;
    const dataLoaded = this.isLoaded();

    // we dont need it if we already made it on server-side
    if (!dataLoaded) {
      this.loadAsyncData(this.props, this.context);
    }
  }

  componentWillReceiveProps(nextProps, nextContext) {
    // Allow a user supplied function to determine if an async reload is necessary
    if (this.props.reloadOnPropsChange.call(this, nextProps, nextContext)) {
      this.loadAsyncData(nextProps, nextContext);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.state.pathAndQuery !== nextState.pathAndQuery;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  startLoad(beginGlobalLoadFn) {
    if (this.globalLoadCounter === 0) {
      beginGlobalLoadFn();
    }

    this.globalLoadCounter += 1;
  }

  endLoad(endGlobalLoadFn) {
    this.globalLoadCounter -= 1;
    if (this.globalLoadCounter === 0) {
      endGlobalLoadFn();
    }
  }

  isLoaded() {
    const { reducerName } = this.props;
    const { store } = this.context;
    return getMutableState(store.getState())[reducerName].loaded === true;
  }

  loadAsyncData(props, context) {
    const self = this;
    const { store, router } = context;
    const { routes, location, helpers, beginGlobalLoad, endGlobalLoad } = props;

    const pathAndQuery = getRoutePathAndQuery(location, router);
    const dispatcherPromise = invokeRouteDispatchers(store, routes, pathAndQuery, helpers);

    self.currentLocation = pathAndQuery;
    self.startLoad(beginGlobalLoad);
    return ((fnProps, fnCtx, loadDataLocation, endGlobalLoadFn) => dispatcherPromise.then(() => {
      // We need to update state only if loadAsyncData that called this promise
      // is the same location as loadAsyncData method. Otherwise we can face a situation
      // when user is changing route several times and we finally show them route that has
      // loaded props last time and not the last called route
      if (self.currentLocation === loadDataLocation && self.mounted !== false) {
        self.setState(filterPropsToState(fnProps, fnCtx));
      }

      self.endLoad(endGlobalLoadFn);
    }, (err) => {
      self.endLoad(endGlobalLoadFn);
      return Promise.reject(err);
    }))(props, context, pathAndQuery, endGlobalLoad);
  }

  render() {
    const { routes } = this.props;
    if (Array.isArray(routes)) {
      return this.props.render(routes);
    }

    return null;
  }
}
