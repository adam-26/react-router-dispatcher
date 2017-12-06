/* eslint-disable react/prop-types */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Route } from 'react-router';
import { renderRoutes } from 'react-router-config';
import { createPath } from 'history';
import dispatchRouteActions, { parseDispatchActions } from './dispatchRouteActions';

function getDispatcherProps(props) {
  const { routes, routeComponentPropNames, dispatchActionParams } = props;
  return { routes, routeComponentPropNames, dispatchActionParams };
}

function standardizeDispatchActions(dispatchActions) {
    if (typeof dispatchActions === 'function') {
        return dispatchActions;
    }

    return parseDispatchActions(dispatchActions);
}

function filterProps(props, propTypes) {
    const filteredProps = {};
    Object.keys(props).forEach(key => {
        if(!(key in propTypes)) {
            filteredProps[key] = props[key];
        }
    });

    return filteredProps;
}

function isDispatchActionsEqual(arr1, arr2) {
    // Determine if a function was passed.
    const isFunc1 = typeof arr1 === 'function';
    const isFunc2 = typeof arr2 === 'function';
    if (isFunc1 || isFunc2) {
        if (isFunc1 !== isFunc2) {
            return false;
        }

        return arr1 === arr2;
    }

    // It should be an array
    if (arr1.length !== arr2.length) {
        return false;
    }

    for (let idx = 0, len = arr1.length; idx < len; idx++) {
        const item1 = arr1[idx];
        const item2 = arr2[idx];

        const isArray1 = Array.isArray(item1);
        if (isArray1 !== Array.isArray(item2)) {
            return false;
        }

        if (isArray1) {
            if (!isDispatchActionsEqual(item1, item2)) {
                return false;
            }
        }
        else {
            for (let j = 0, len = item1.length; j < len; j++) {
                if (item1[j] !== item2[j]) {
                    return false;
                }
            }
        }
    }

    return true;
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
        PropTypes.string,
        PropTypes.func
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
    dispatchActionParams: PropTypes.any,
};

const DEFAULT_DISPATCH_ACTIONS = [['loadData']];

class RouteDispatcher extends Component {
    static propTypes = {
      ...RouteDispatcherPropTypes,

      // routes are required
      routes: RouteDispatcherPropTypes.routes.isRequired,

      /**
       * React router props
       */
      match: PropTypes.object,
      location: PropTypes.object,
      history: PropTypes.object
    };

    static defaultProps = {
      dispatchActionParams: {},
      dispatchActions: DEFAULT_DISPATCH_ACTIONS,
      routeComponentPropNames: ['component', 'components'],
      hasDispatchedActions: false,
      loadingComponent: <div>Loading...</div>,
      render(routes, routeProps) {
        return renderRoutes(routes, routeProps);
      },
    };

    static dispatch(location, dispatchActions, props) {
      return dispatchRouteActions(location, { dispatchActions, ...getDispatcherProps(props) });
    }

    constructor(props, context) {
      super(props, context);
      this.state = {
        previousLocation: null,
        hasDispatchedActions: props.hasDispatchedActions,
        dispatchActions: standardizeDispatchActions(props.dispatchActions)
      };
    }

    componentWillMount() {
      const { hasDispatchedActions, dispatchActions } = this.state;
      if (hasDispatchedActions) {
        // data is already loaded
        return;
      }

      const { location, ...props } = this.props;
      RouteDispatcher.dispatch(location, dispatchActions, props).then(() => {
        // re-render after data has loaded
        this.setState({ hasDispatchedActions: true });
      });
    }

    componentWillReceiveProps(nextProps) {
      const { location } = this.props;
      const receivedDispatchActions = typeof nextProps.dispatchActions !== 'undefined';
      const newState = receivedDispatchActions ?
          { dispatchActions: standardizeDispatchActions(nextProps.dispatchActions) } :
          {};

      const hasLocationChanged =
          typeof nextProps.location !== 'undefined' &&
          createPath(nextProps.location) !== createPath(location);

      if (hasLocationChanged ||
          (receivedDispatchActions &&
          !isDispatchActionsEqual(newState.dispatchActions, this.state.dispatchActions))) {
        this.setState({ ...newState, previousLocation: location });

        // load data while the old screen remains
        RouteDispatcher.dispatch(location, this.state.dispatchActions, nextProps).then(() => {
          // clear previousLocation so the next screen renders
          this.setState({ previousLocation: null });
        });
      }
    }

    render() {
        const { location, routes, render, loadingComponent } = this.props;
        const { hasDispatchedActions, previousLocation } = this.state;
        if (!hasDispatchedActions) {
            // Display a loading indicator until data is loaded
            return loadingComponent;
        }

        return (
            <Route
                location={previousLocation || location}
                render={() => render(
                    Array.isArray(routes) ? routes : null,
                    filterProps(this.props, RouteDispatcher.propTypes)
                )}
            />
        );
    }
}

export {
    RouteDispatcherPropTypes,
    RouteDispatcher,
    standardizeDispatchActions,
    DEFAULT_DISPATCH_ACTIONS
};