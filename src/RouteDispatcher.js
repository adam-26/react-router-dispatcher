/* eslint-disable react/prop-types */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Route } from 'react-router';
import { renderRoutes } from 'react-router-config';
import { createPath } from 'history';
import dispatchRouteActions, { parseDispatchActions } from './dispatchRouteActions';

function getDispatcherProps(props) {
  const { routes, routeComponentPropNames, actionParams } = props;
  return { routes, routeComponentPropNames, actionParams };
}

function standardizeDispatchActions(dispatchActions) {
    if (typeof dispatchActions === 'function') {
        return dispatchActions;
    }

    return parseDispatchActions(dispatchActions);
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

const DefaultLoadingIndicator = () => (
    <div>Loading...</div>
);

const DEFAULT_DISPATCH_ACTIONS = [['loadData']];
const DEFAULT_COMPONENT_PROP_NAMES = ['component', 'components'];

class RouteDispatcher extends Component {
    static propTypes = {
        /**
         * The function used to render routes.
         */
        render: PropTypes.func,

        /**
         * The configured react-router routes (using react-router-config format).
         */
        routes: PropTypes.array.isRequired,

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
        loadingIndicator: PropTypes.oneOfType([
            PropTypes.node,
            PropTypes.element,
            PropTypes.func
        ]),

        /**
         * True to dispatch actions on the first render, otherwise false.
         *
         * If rendering on the server, this should be set to false.
         */
        dispatchActionsOnFirstRender: PropTypes.bool,

        /**
         * Helpers are passed to all action dispatchers
         */
        actionParams: PropTypes.any,

        /**
        * React router props
        */
        match: PropTypes.object,
        location: PropTypes.object,
        history: PropTypes.object
    };

    static defaultProps = {
      actionParams: {},
      dispatchActions: DEFAULT_DISPATCH_ACTIONS,
      routeComponentPropNames: DEFAULT_COMPONENT_PROP_NAMES,
      dispatchActionsOnFirstRender: true,
      loadingIndicator: DefaultLoadingIndicator,
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
        hasDispatchedActions: !props.dispatchActionsOnFirstRender,
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
        const {
            location,
            routes,
            render,
            loadingIndicator,
            // DO NOT DELETE THESE PROPS - this is the easiest way to access route props
            /* eslint-disable no-unused-vars */
            dispatchActions,
            routeComponentPropNames,
            dispatchActionsOnFirstRender,
            actionParams,
            match,
            history,
            /* eslint-enable no-unused-vars */
            ...routeProps
        } = this.props;

        if (!this.state.hasDispatchedActions) {
            // Display a loading indicator until data is loaded
            return React.isValidElement(loadingIndicator) || typeof loadingIndicator === 'function' ?
                React.createElement(loadingIndicator) :
                <div>{loadingIndicator}</div>;
        }

        return (
            <Route
                location={this.state.previousLocation || location}
                render={() => render(
                    Array.isArray(routes) ? routes : null,
                    routeProps
                )}
            />
        );
    }
}

export {
    RouteDispatcher,
    standardizeDispatchActions,
    DEFAULT_DISPATCH_ACTIONS,
    DEFAULT_COMPONENT_PROP_NAMES
};