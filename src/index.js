import React from 'react';
import PropTypes from 'prop-types';
import invariant from 'invariant';
import { withRouter } from 'react-router';
import { parsePath } from 'history'
import hoistNonReactStatic from 'hoist-non-react-statics';
import { RouteDispatcher, RouteDispatcherPropTypes, standardizeDispatchActions, DEFAULT_DISPATCH_ACTIONS } from './RouteDispatcher';
import defineRoutes from './defineRoutes';

const RouterDispatcher = withRouter(RouteDispatcher);

function RouteDispatcherHoc(routeConfig, options) {
    const routeDispatcher = ({ routes, ...props }) => {
        return (
            <RouterDispatcher
                routes={routes || routeConfig}
                {...options}
                {...props}
            />);
    };

    routeDispatcher.displayName = 'withRouter(RouteDispatcher)';

    routeDispatcher.propTypes = {
        ...RouteDispatcherPropTypes,
        routes: PropTypes.array.isRequired,
    };

    return hoistNonReactStatic(routeDispatcher, RouterDispatcher);
}

// use a factory method to simplify server usage
function createRouteDispatcher(pathAnyQuery, routeConfig, options = {}) {
    invariant(typeof pathAnyQuery === 'string', 'pathAnyQuery expects a string');
    invariant(Array.isArray(routeConfig), 'routeConfig expects an array of routes');

    return {
        dispatchOnServer: () =>
            RouterDispatcher.dispatch(
                parsePath(pathAnyQuery),
                standardizeDispatchActions(options.dispatchActions || DEFAULT_DISPATCH_ACTIONS),
                { ...options, routes: routeConfig }),
        RouteDispatcher: RouteDispatcherHoc(routeConfig, { ...options, hasDispatchedActions: true }),
    };
}

export {
    defineRoutes,
    createRouteDispatcher,
    RouterDispatcher as RouteDispatcher,
};
