import { Component } from 'react';
import PropTypes from 'prop-types';
import { renderRoutes } from 'react-router-config';
import { invokeAsyncDispatchers } from '../helpers/utils';
import { getMutableState } from '../helpers/state';

export class AsyncRouteLoader extends Component {
  static propTypes = {
    render: PropTypes.func.isRequired,
    reloadOnPropsChange: PropTypes.func,
    /* eslint-disable react/forbid-prop-types, react/no-unused-prop-types */
    beginGlobalLoad: PropTypes.func.isRequired,
    endGlobalLoad: PropTypes.func.isRequired,
    reducerName: PropTypes.string,
    routes: PropTypes.array.isRequired,
    location: PropTypes.string.isRequired,
    helpers: PropTypes.any,
    /* eslint-enable */
  };

  static contextTypes = {
    store: PropTypes.object.isRequired,
  };

  static defaultProps = {
    helpers: {},
    reducerName: 'asyncReduxDispatcher',
    reloadOnPropsChange() {
      return true;
    },
    render({ routes }) {
      return renderRoutes(routes);
    },
  };

  constructor(props, context) {
    super(props, context);

    this.state = {
      propsToShow: this.isLoaded() ? props : null,
    };

    this.mounted = false;
    this.loadDataCounter = 0;
  }

  componentDidMount() {
    this.mounted = true;
    const dataLoaded = this.isLoaded();

    // we dont need it if we already made it on server-side
    if (!dataLoaded) {
      this.loadAsyncData(this.props);
    }
  }

  componentWillReceiveProps(nextProps) {
    // Allow a user supplied function to determine if an async reload is necessary
    if (this.props.reloadOnPropsChange(this.props, nextProps)) {
      this.loadAsyncData(nextProps);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.state.propsToShow !== nextState.propsToShow;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  isLoaded() {
    const { reducerName } = this.props;
    return getMutableState(this.context.store.getState())[reducerName].loaded;
  }

  loadAsyncData(props) {
    const { store } = this.context;
    const { routes, location, helpers, beginGlobalLoad, endGlobalLoad } = props;
    const dispatcherPromise = invokeAsyncDispatchers(routes, store, location, helpers);

    // TODO: think of a better solution to a problem?
    this.loadDataCounter += 1;
    beginGlobalLoad();
    return (loadDataCounterOriginal => dispatcherPromise.then(() => {
      // We need to change propsToShow only if loadAsyncData that called this promise
      // is the last invocation of loadAsyncData method. Otherwise we can face a situation
      // when user is changing route several times and we finally show him route that has
      // loaded props last time and not the last called route
      if (this.loadDataCounter === loadDataCounterOriginal && this.mounted !== false) {
        this.setState({ propsToShow: props });
      }

      // TODO: investigate race conditions
      // do we need to call this if it's not last invocation?
      endGlobalLoad();
    }))(this.loadDataCounter);
  }

  render() {
    const { propsToShow } = this.state;
    return propsToShow && this.props.render(propsToShow);
  }
}

export default AsyncRouteLoader;
