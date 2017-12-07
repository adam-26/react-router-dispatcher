import React from 'react';
import invariant from 'invariant';
import { withRouter } from 'react-router';
import { parsePath } from 'history'
import hoistNonReactStatic from 'hoist-non-react-statics';
import defineRoutes from './defineRoutes';
import {
    RouteDispatcher,
    standardizeDispatchActions,
    DEFAULT_DISPATCH_ACTIONS,
    DEFAULT_COMPONENT_PROP_NAMES
} from './RouteDispatcher';

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

    routeDispatcher.propTypes = RouteDispatcher.propTypes;

    return hoistNonReactStatic(routeDispatcher, RouterDispatcher);
}

// use a factory method to simplify server usage
function createRouteDispatcher(pathAnyQuery, routeConfig, options = {}) {
    invariant(typeof pathAnyQuery === 'string', 'pathAnyQuery expects a string');
    invariant(Array.isArray(routeConfig), 'routeConfig expects an array of routes');

    const dispatchOpts = Object.assign(
        { routeComponentPropNames: DEFAULT_COMPONENT_PROP_NAMES },
        options,
        { routes: routeConfig });

    return {
        dispatchOnServer: () =>
            RouterDispatcher.dispatch(
                parsePath(pathAnyQuery),
                standardizeDispatchActions(options.dispatchActions || DEFAULT_DISPATCH_ACTIONS),
                dispatchOpts),
        RouteDispatcher: RouteDispatcherHoc(routeConfig, { ...options, hasDispatchedActions: true }),
    };
}

export {
    defineRoutes,
    createRouteDispatcher,
    RouterDispatcher as RouteDispatcher,
};
