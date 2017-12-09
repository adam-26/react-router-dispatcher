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
import {matchRouteComponents} from './dispatchRouteActions';

const __DEV__ = process.env.NODE_ENV !== 'production';
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

    const { routes, ...componentOptions } = dispatchOpts;

    return {

        /**
         * dispatch route actions on the server.
         *
         * @param pathAndQuery string the requested url path and query
         * @param params Object params for actions
         * @param options [Object] options for server dispatching
         * @returns {*} Components for rendering routes
         */
        dispatchServerActions: (pathAndQuery, params, options) => {
            invariant(typeof pathAndQuery === 'string', 'pathAnyQuery expects a string');

            const { actions, ...serverOptions } = { ...dispatchOpts, ...options };
            return RouterDispatcher.dispatch(
                parsePath(pathAndQuery),
                standardizeDispatchActions(actions),
                serverOptions);


            // invariant(typeof pathAndQuery === 'string', 'pathAnyQuery expects a string');
            //
            // const { dispatchActions, ...serverOptions } = options;
            // const serverDispatchActions = standardizeDispatchActions(
            //     dispatchActions || options.dispatchActions || DEFAULT_DISPATCH_ACTIONS);
            //
            // return RouterDispatcher.dispatch(
            //     parsePath(pathAndQuery),
            //     serverDispatchActions,
            //     {...dispatchOpts, ...serverOptions, actionParams})
        },

        // TODO: Standardize server/client params and method names

        /**
         * Synchronous client dispatcher
         *
         * @param pathAndQuery
         * @param params
         * @param options
         */
        dispatchClientActions: (pathAndQuery, params, options) => {
            invariant(typeof pathAndQuery === 'string', 'pathAnyQuery expects a string');

            if (__DEV__) {
                // todo; validate ACTIONS
            }

            const { actions, routes, routeComponentPropNames } = { ...dispatchOpts, ...options };

            const location = parsePath(pathAndQuery);
            const clientActionSets = standardizeDispatchActions(actions); // TODO: Update for FN()s
            const routeComponents = matchRouteComponents(
                location,
                routes,
                routeComponentPropNames);


            let out = {};
            const actionParams = {};
            clientActionSets.forEach(actionSet => {
               actionSet.forEach(({ actionName, params, reduceClientProps }) => {

                   // Append each action(s) parameters
                   // - allows actions to access params of previous actions
                   Object.assign(actionParams, params);

                   routeComponents.forEach(([component, match, routerCtx]) => {
                       if (typeof component[actionName] === 'function') {
                           component[actionName]({ location, match }, actionParams, routerCtx);
                           out = reduceClientProps(out);
                       }
                   });
               });
            });

            return out;
        },

        ClientRouteDispatcher: RouteDispatcherHoc(
            'ClientRouteDispatcher',
            routes,
            componentOptions),

        UniversalRouteDispatcher: RouteDispatcherHoc(
            'UniversalRouteDispatcher',
            routes,
            { ...componentOptions, dispatchActionsOnFirstRender: false })
    };
}

export {
    defineRoutes,
    createRouteDispatchers,
    RouterDispatcher as RouteDispatcher,
    matchRouteComponents
};


// TODO: Can the FACTORY return a 'dispatchClientActions()' method - with defaults assigned? (NOT including 'dispatchActions')??
// -> result: dispatchClientActions(location, dispatchActions, actionParams);
//    example:dispatchClientActions(location, [[clientMetadataAction]] [, params]);
//     * where: clientMetadataAction is a FUNC that returns { dispatchActionName, actionParams } -> merged with 'params'
// TODO: Can this be refactored, and accept an arg that indicates the methods to invoke - so a single match
//       could be used to invoke multiple actions?
// ie: dispatchRouteActions(location, routes, dispatchActions[, { routerComponentPropNames }]); // last is OPT
