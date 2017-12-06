import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import hoistNonReactStatic from 'hoist-non-react-statics';
import { RouteDispatcher, RouteDispatcherPropTypes } from './RouteDispatcher';
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
function createRouteDispatcher(location, routeConfig, options) {
    return {
        dispatchOnServer: () => RouterDispatcher.dispatchActions(location, { ...options, routes: routeConfig }),
        RouteDispatcher: RouteDispatcherHoc(routeConfig, { ...options, hasDispatchedActions: true }),
    };
}

export {
    defineRoutes,
    createRouteDispatcher,
    RouterDispatcher as RouteDispatcher,
};
