import React from 'react';
import invariant from 'invariant';
import { withRouter } from 'react-router';
import { parsePath } from 'history'
import hoistNonReactStatic from 'hoist-non-react-statics';
import reactDisplayName from 'react-display-name';
import defineRoutes from './defineRoutes';
import {
    RouteDispatcher,
    standardizeDispatchActions,
    DEFAULT_DISPATCH_ACTIONS,
    DEFAULT_COMPONENT_PROP_NAMES
} from './RouteDispatcher';

const RouterDispatcher = withRouter(RouteDispatcher);

function RouteDispatcherHoc(displayNamePrefix, routeConfig, options) {
    const routeDispatcher = ({ routes, ...props }) => {
        return (
            <RouterDispatcher
                routes={routes || routeConfig}
                {...options}
                {...props}
            />);
    };

    routeDispatcher.displayName = `${displayNamePrefix}(${reactDisplayName(RouterDispatcher)})`;

    routeDispatcher.propTypes = RouteDispatcher.propTypes;

    return hoistNonReactStatic(routeDispatcher, RouterDispatcher);
}

// use a factory method to simplify server usage
function createRouteDispatchers(routeConfig, options = {}) {
    invariant(Array.isArray(routeConfig), 'routeConfig expects an array of routes');

    const dispatchOpts = Object.assign(
        { routeComponentPropNames: DEFAULT_COMPONENT_PROP_NAMES },
        options,
        { routes: routeConfig });

    return {
        dispatchOnServer: (pathAnyQuery, dispatchActionParams) => {
            invariant(typeof pathAnyQuery === 'string', 'pathAnyQuery expects a string');

            return RouterDispatcher.dispatch(
                parsePath(pathAnyQuery),
                standardizeDispatchActions(options.dispatchActions || DEFAULT_DISPATCH_ACTIONS),
                {...dispatchOpts, dispatchActionParams})
        },
        ClientRouteDispatcher:    RouteDispatcherHoc('ClientRouteDispatcher', routeConfig, options),
        UniversalRouteDispatcher: RouteDispatcherHoc(
            'UniversalRouteDispatcher',
            routeConfig,
            { ...options, hasDispatchedActions: true })
    };
}

export {
    defineRoutes,
    createRouteDispatchers,
    RouterDispatcher as RouteDispatcher,
};
