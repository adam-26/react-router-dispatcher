// @flow
import React from 'react';
import { parsePath } from 'history'
import hoistNonReactStatic from 'hoist-non-react-statics';
import reactDisplayName from 'react-display-name';
import invariant from 'invariant';
import warning from 'warning';
import RouteDispatcher, { DEFAULT_COMPONENT_PROP_NAMES } from './RouteDispatcher';
import { getRouteComponents } from './dispatchRouteActions';

const __DEV__ = process.env.NODE_ENV !== 'production';

function RouteDispatcherHoc(displayNamePrefix, routeConfig, options) {
    const routerDispatcher = ({ routes, ...props }) => {
        return (
            <RouteDispatcher
                routes={routes || routeConfig}
                {...options}
                {...props}
            />);
    };

    routerDispatcher.displayName = `${displayNamePrefix}(${reactDisplayName(RouteDispatcher)})`;

    routerDispatcher.propTypes = RouteDispatcher.propTypes;

    return hoistNonReactStatic(routerDispatcher, RouteDispatcher);
}

function mergeActions(flatActions, actionNames) {
    return flatActions.reduce((actions, actionName) => {
        if (actions.indexOf(actionName) === -1) {
            actions.push(actionName);
        }

        return actions;
    }, actionNames);
}

function getActionNames(actions) {
    return actions.map(action => {
        if (Array.isArray(action)) {
            return getActionNames(action);
        }

        if (typeof action.name === 'string') {
            return action.name;
        }

        invariant(false, `invalid dispatcher action 'name', expected string but encountered ${action.name}`);
    });
}

function findRouteActions(routes, routeComponentPropNames, actionNames = []) {
    routes.forEach(route => {
        getRouteComponents(route, routeComponentPropNames).forEach(({ routeComponent }) => {
            if (typeof routeComponent.getDispatcherActions === 'function') {
                mergeActions(getActionNames(routeComponent.getDispatcherActions()), actionNames);
            }
        });

        if (Array.isArray(route.routes)) {
            findRouteActions(route.routes, routeComponentPropNames, actionNames);
        }
    });

    return actionNames;
}

function flattenActions(actions) {
    if (!Array.isArray(actions)) {
        return [actions];
    }

    return actions.reduce((flatActions, action) => {
        if (Array.isArray(action)) {
            Array.prototype.push.apply(flatActions, flattenActions(action));
        }
        else {
            flatActions.push(action);
        }

        return flatActions;
    }, []);
}

function createDispatchAction(dispatchFuncName, pathAndQuery, params, options) {
    invariant(typeof pathAndQuery === 'string', 'pathAnyQuery expects a string');

    const { actionNames, routes, routeComponentPropNames } = options;
    return RouteDispatcher[dispatchFuncName](
        parsePath(pathAndQuery),
        actionNames,
        { routes, routeComponentPropNames },
        Object.assign({}, params));
}

// use a factory method to simplify server usage
export default function createRouteDispatchers(routeConfig, actionNames, options = {}) {
    invariant(Array.isArray(routeConfig), 'routeConfig expects an array of routes');

    const dispatchOpts = Object.assign(
        { routeComponentPropNames: DEFAULT_COMPONENT_PROP_NAMES },
        options,
        { actionNames: actionNames, routes: routeConfig });

    const { routes, ...componentOptions } = dispatchOpts;

    // If no actions are configured, determine actions from component configuration
    if (typeof dispatchOpts.actionNames === 'undefined' || dispatchOpts.actionNames === null) {
        dispatchOpts.actionNames = findRouteActions(routes, dispatchOpts.routeComponentPropNames);
    }
    else if (__DEV__) {
        const configuredActionNames = flattenActions(dispatchOpts.actionNames);
        const routeActionNames = findRouteActions(routes, dispatchOpts.routeComponentPropNames);

        const unconfiguredActions = routeActionNames.filter(actionName => configuredActionNames.indexOf(actionName) === -1);
        const unusedActions = configuredActionNames.filter(actionName => routeActionNames.indexOf(actionName) === -1);
        warning(unconfiguredActions.length === 0, `The actions '${unconfiguredActions.join(', ')}' are used by route components, but are not configured for use by the route dispatcher.`);
        warning(unusedActions.length === 0, `The actions '${unusedActions.join(', ')}' are configured for use with the route dispatcher, but no route components have the action(s) applied.`);
    }

    return {

        /**
         * The configured action name(s). Useful for debugging purposes.
         */
        actionNames: dispatchOpts.actionNames.slice(),

        /**
         * dispatch route actions on the server.
         *
         * @param pathAndQuery string the requested url path and query
         * @param params Object params for actions
         * @param options [Object] options for server dispatching
         * @returns {*} Components for rendering routes
         */
        dispatchServerActions: (pathAndQuery, params = {}, options = {}) =>
            createDispatchAction('dispatchServerActions', pathAndQuery, params, { ...dispatchOpts, ...options }),

        /**
         * Synchronous client dispatcher
         *
         * @param pathAndQuery
         * @param params
         * @param options
         */
        dispatchClientActions: (pathAndQuery, params = {}, options = {}) =>
            createDispatchAction('dispatchClientActions', pathAndQuery, params, { ...dispatchOpts, ...options }),

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
