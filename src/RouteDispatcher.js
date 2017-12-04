import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { renderRoutes } from 'react-router-config';
import { createPath } from 'history';
import invariant from 'invariant';
import dispatchRouteActions from './dispatchRouteActions';

function getDispatcherProps(props) {
  const { routes, dispatchActions, routeComponentPropNames, helpers } = props;
  return { routes, dispatchActions, routeComponentPropNames, helpers };
}

function standardizeDispatchActions(dispatchActions) {
    if (typeof dispatchActions === 'string') {
        return [[dispatchActions]];
    }

    if (Array.isArray(dispatchActions)) {
        if ((!Array.isArray(dispatchActions[0]))) {
            // if its a flat array, wrap actions to be an action set
            return [dispatchActions];
        }

        return dispatchActions.map(actionSet => {
            if (Array.isArray(actionSet)) {
                return actionSet;
            }

            if (typeof actionSet === 'string') {
                return [actionSet];
            }

            invariant(false, `Invalid dispatch action, '${actionSet}', expected string or array.`);
        });
    }

    invariant(false, 'Invalid dispatch actions, expected string or array.');
}

const RouteDispatcherPropTypes = {
    /**
     * The function used to render routes.
     */
    render: PropTypes.func,

    /**
     * The configured react-router routes (using react-router-config format).
     */
    routes: PropTypes.array,

    /**
     * The name(s) of of static action dispatcher functions to invoke on route components.
     *
     * This can be a string, and array, or an array or arrays. When an array of arrays,
     * each array of actions is dispatched serially.
     */
    dispatchActions: PropTypes.oneOfType([
        PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),
        PropTypes.arrayOf(PropTypes.string),
        PropTypes.string
    ]),

    /**
     * The name(s) of props on route components that can contain action dispatchers
     */
    routeComponentPropNames: PropTypes.arrayOf(PropTypes.string),

    /**
     * The component to render when data is initially loading
     */
    loadingComponent: PropTypes.element,

    /**
     * True if actions have been dispatched, otherwise false.
     *
     * If rendering on the server, this should be set to true on the initial client render.
     */
    hasDispatchedActions: PropTypes.bool,

    /**
     * Helpers are passed to all action dispatchers
     */
    helpers: PropTypes.any,
};

class RouteDispatcher extends Component {
    static propTypes = {
      ...RouteDispatcherPropTypes,

      /**
       * React router props
       */
      match: PropTypes.object,
      location: PropTypes.object,
      history: PropTypes.object
    };

    static defaultProps = {
      helpers: {},
      dispatchActions: [['loadData']],
      routeComponentPropNames: ['component', 'components'],
      hasDispatchedActions: false,
      loadingComponent: <div>Loading...</div>,
      render(routes) {
        return renderRoutes(routes);
      },
    };

    static dispatchActions = (location, props) => {
      return dispatchRouteActions(location, getDispatcherProps(props));
    };

    constructor(props, context) {
      const { dispatchActions, ...remainingProps } = props;
      super({ ...remainingProps, dispatchActions: standardizeDispatchActions(dispatchActions)}, context);
      this.state = {
        previousLocation: null,
        hasDispatchedActions: props.hasDispatchedActions,
      };
    }

    componentWillMount() {
      if (this.state.hasDispatchedActions) {
        // data is already loaded
        return;
      }

      const { location, ...props } = this.props;
      RouteDispatcher.dispatchActions(location, props).then(() => {
        // re-render after data has loaded
        this.setState({ hasDispatchedActions: true });
      });
    }

    componentWillReceiveProps(nextProps) {
      const { location } = this.props;
      const hasLocationChanged = createPath(nextProps.location) !== createPath(location);

      if (hasLocationChanged) {
        this.setState({ previousLocation: location });

        // load data while the old screen remains
        RouteDispatcher.dispatchActions(location, nextProps).then(() => {
          // clear previousLocation so the next screen renders
          this.setState({ previousLocation: null });
        });
      }
    }

    render() {
      const { routes, render, loadingComponent } = this.props;
      if (!this.state.hasDispatchedActions) {
        // Display a loading indicator until data is loaded
        return loadingComponent;
      }

      if (Array.isArray(routes)) {
        return render(routes);
      }

      return null;
    }
}

export {
    RouteDispatcherPropTypes,
    RouteDispatcher
};