import { Component } from 'react';
import PropTypes from 'prop-types';
import { renderRoutes } from 'react-router-config';
import { invokeRouteDispatchers, REDUCER_NAME } from '../utils';
import { getMutableState } from '../state';

function getRoutePathAndQuery({ router: { route: { location } } }) {
  return `${location.pathname}${location.search}${location.hash}`;
}

function filterPropsToState(props, context) {
  const { routes } = props;
  return {
    routes,
    location: getRoutePathAndQuery(context),
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
    routes: PropTypes.array.isRequired,
    helpers: PropTypes.any,
    /* eslint-enable */
  };

  static contextTypes = {
    store: PropTypes.object.isRequired,
    router: PropTypes.object.isRequired,
  };

  static defaultProps = {
    helpers: {},
    reducerName: REDUCER_NAME,
    reloadOnPropsChange({ state, nextContext }) {
      return state.location !== getRoutePathAndQuery(nextContext);
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
      this.loadAsyncData(this.props);
    }
  }

  componentWillReceiveProps(nextProps, nextContext) {
    // Allow a user supplied function to determine if an async reload is necessary
    if (this.props.reloadOnPropsChange({
      state: this.state,
      props: this.props,
      context: this.context,
      nextProps,
      nextContext,
    })) {
      this.loadAsyncData(nextProps);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.state.location !== nextState.location;
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
    return getMutableState(this.context.store.getState())[reducerName].loaded === true;
  }

  loadAsyncData(props) {
    const self = this;
    const { store } = self.context;
    const { routes, helpers, beginGlobalLoad, endGlobalLoad } = props;

    const pathAndQuery = getRoutePathAndQuery(self.context);
    const dispatcherPromise = invokeRouteDispatchers(store, routes, pathAndQuery, helpers);

    self.currentLocation = pathAndQuery;
    self.startLoad(beginGlobalLoad);
    return ((prps, ctx, loadDataLocation, endGlobalLoadFn) => dispatcherPromise.then(() => {
      // We need to update state only if loadAsyncData that called this promise
      // is the same location as loadAsyncData method. Otherwise we can face a situation
      // when user is changing route several times and we finally show them route that has
      // loaded props last time and not the last called route
      if (self.currentLocation === loadDataLocation && self.mounted !== false) {
        self.setState(filterPropsToState(prps, ctx));
      }

      self.endLoad(endGlobalLoadFn);
    }, (err) => {
      self.endLoad(endGlobalLoadFn);
      return Promise.reject(err);
    }))(props, self.context, pathAndQuery, endGlobalLoad);
  }

  render() {
    const { routes } = this.state;
    if (Array.isArray(routes)) {
      return this.props.render(routes);
    }

    return null;
  }
}
