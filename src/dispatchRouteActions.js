// @flow
import React from 'react';
import invariant from 'invariant';
import { matchRoutes } from 'react-router-config';

const defaultParams = {
    httpResponse: {
        statusCode: 200
    }
};

function isRouteComponent(routeComponent) {
    return React.isValidElement(routeComponent) || typeof routeComponent === 'function';
}

function addRouteComponent(component, match, route, routeComponentKey, target) {
    target.push([component, match, { route, routeComponentKey }]);
}

export function getRouteComponents(route, routeComponentPropNames) {
    const routeComponents = [];
    routeComponentPropNames.forEach((propName) => {
        const routeComponent = route[propName];
        if (isRouteComponent(routeComponent)) {
            routeComponents.push({
                routeComponentKey: propName,
                routeComponent: routeComponent
            });
        }
        else if (routeComponent !== null && typeof routeComponent === 'object') {
            // support assigning component(s) using key/value pairs (object)
            Object.keys(routeComponent).forEach(componentName => {
                const component = routeComponent[componentName];
                if (isRouteComponent(component)) {
                    routeComponents.push({
                        routeComponentKey: `${propName}.${componentName}`,
                        routeComponent: routeComponent
                    });
                }
            });
        }
    });

    return routeComponents;
}

export function resolveRouteComponents(branch, routeComponentPropNames) {
    const routeComponents = [];
    branch.forEach(({ route, match }) => {
        // get the route component(s) for each route
        getRouteComponents(route, routeComponentPropNames).forEach(({ routeComponent, routeComponentKey }) => {
            addRouteComponent(routeComponent, match, route, routeComponentKey, routeComponents);
        });
    });

    return routeComponents
}

export function resolveActionSets(routeComponents, dispatchActions, initParamFuncName, isLifecycleMethod, actionFilter) {
    const actionSets = parseDispatchActions(dispatchActions);
    const resolvedActionSets = [];

    actionSets.forEach(actionSet => {
        actionSet.forEach(actionName => {
            const promises = [];
            let action = null;

            routeComponents.forEach(([component, match, routerContext]) => {
                if (typeof component.getDispatcherActions !== 'function') {
                    return;
                }

                const componentActions = component.getDispatcherActions([actionName], actionFilter);
                if (componentActions.length === 0) {
                    return;
                }

                // The dispatcher should invoke each individual action
                invariant(componentActions.length === 1, '[react-router-dispatcher]: .getDispatcherActions() returned more than 1 component action.');

                const componentAction = componentActions[0];
                if (action === null) {
                    action = componentAction;
                }

                const { staticMethod, staticMethodName } = componentAction;
                const actionMethod = staticMethod || component[staticMethodName];
                promises.push([actionMethod, match, routerContext]);
            });

            if (action === null) {
                return;
            }

            const { successHandler, errorHandler, stopServerActions, mapParamsToProps } = action;
            resolvedActionSets.push({
                routeActions: promises,
                actionSuccessHandler: typeof successHandler === 'function' ? successHandler : () => null,
                actionErrorHandler: typeof errorHandler === 'function' ? errorHandler : err => { throw err },
                stopServerActions: typeof stopServerActions === 'function' ? stopServerActions : false, // here or bundled with route actions?
                initParams: isLifecycleMethod ?
                    props => props :
                    (typeof initParamFuncName === 'string' && action[initParamFuncName]) || (params => params),
                mapToProps: isLifecycleMethod ?
                    props => props :
                    mapParamsToProps
            });

        });
    });

    return resolvedActionSets;
}

function createActionSetPromise(resolvedActionSet, location, params) {
    const {
        routeActions,
        actionSuccessHandler,
        actionErrorHandler,
        stopServerActions,
        initParams,
        mapToProps
    } = resolvedActionSet;

    // Invoke each route action
    return Promise.all(routeActions.map(([componentAction, match, routerContext]) => {
        return Promise.resolve(componentAction(
            {location, match},
            mapToProps(Object.assign(params, initParams(params)), routerContext),
            routerContext));
        })
    )

    // Invoke any configured post-action handlers
    .then(() => Promise.resolve(actionSuccessHandler({location}, params)))

    // Handle any action-specific error(s)
    .catch(err => actionErrorHandler({location}, err))

    // determine if the next action set should be invoked
    .then(() => Promise.resolve(
        // eslint-disable-next-line no-unused-vars
        !routeActions.some(([ componentAction, match, routerContext ]) =>
            stopServerActions === false ?
                false :
                stopServerActions({location, match}, mapToProps(params, routerContext), routerContext))
    ));
}

export function reduceActionSets(resolvedActionSets, location, params) {
    let promiseActionSet = Promise.resolve(true); // always start w/true to invoke the first actionSet

    while (resolvedActionSets.length > 0) {
        const resolvedActionSet = resolvedActionSets.shift(); // IMPORTANT: Leave this on its own line, otherwise tests timeout
        promiseActionSet = promiseActionSet
            .then((invokeActions) =>
                invokeActions ? createActionSetPromise(resolvedActionSet, location, params) : Promise.resolve(invokeActions));
    }
    // TODO... verify PARAMS is "safe" for lifecycle method re-use...
    return promiseActionSet.then(() => Promise.resolve(params));
}

export function matchRouteComponents(location, routes, routeComponentPropNames) {
    const branch = matchRoutes(routes, location.pathname);
    if (!branch.length) {
        return [];
    }

    return resolveRouteComponents(branch, routeComponentPropNames);
}

export function dispatchRouteActions(location, actions, routeConfig, params, initParamFuncName, isLifecycleMethod, actionFilter) {
    const { routes, routeComponentPropNames } = routeConfig;
    const actionParams = Object.assign({}, defaultParams, params);

    // Determine all RouteComponent(s) matched for the current route
    const routeComponents = matchRouteComponents(location, routes, routeComponentPropNames);
    if (routeComponents.length === 0) {
        return Promise.resolve();
    }

    const dispatchActions = typeof actions === 'function' ?
        parseDispatchActions(actions(location, actionParams)) :
        actions;

    const actionSets = resolveActionSets(
        routeComponents,
        dispatchActions,
        initParamFuncName,
        isLifecycleMethod,
        actionFilter);

    return reduceActionSets(actionSets, location, actionParams);
}

function parseDispatchActions(dispatchActions) {
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

            if (typeof dispatchActions === 'string') {
                return [actionSet];
            }

            invariant(false, `Invalid dispatch action, '${actionSet}', expected string or array.`);
        });
    }

    invariant(false, 'Invalid dispatch actions, expected string or array.');
}

export function standardizeActionNames(dispatchActions) {
    if (typeof dispatchActions === 'function') {
        return dispatchActions;
    }

    return parseDispatchActions(dispatchActions);
}

function isClientAction(action) {
    return typeof action.initClientAction === 'function';
}

function isServerAction(action) {
    return typeof action.initServerAction === 'function';
}

/**
 * Dispatches asynchronous actions during a react components lifecycle
 *
 * @param location
 * @param actionNames
 * @param routeConfig
 * @param params
 */
export function dispatchComponentActions(location, actionNames, routeConfig, params) {
    return dispatchRouteActions(
        location,
        actionNames,
        routeConfig,
        params,
        'initComponentAction',
        true);
}

/**
 * Dispatches asynchronous actions on the server
 *
 * @param location
 * @param actionNames
 * @param routeConfig
 * @param params
 * @returns {*}
 */
export function dispatchServerActions(location, actionNames, routeConfig, params) {
    return dispatchRouteActions(
        location,
        standardizeActionNames(actionNames),
        routeConfig,
        params,
        'initServerAction',
        false,
        isServerAction);
}

/**
 * Dispatches synchronous actions on the client.
 *
 * @param location
 * @param actionNames
 * @param routeConfig
 * @param params
 * @returns {*}
 */
export function dispatchClientActions(location, actionNames, routeConfig, params) {
    const { routes, routeComponentPropNames } = routeConfig;

    const clientParams = Object.assign({}, defaultParams, params);
    const clientActionSets = standardizeActionNames(actionNames);
    const routeComponents = matchRouteComponents(
        location,
        routes,
        routeComponentPropNames);

    clientActionSets.forEach(actionSet => {

        routeComponents.forEach(([component, match, routerCtx]) => {
            if (typeof component.getDispatcherActions !== 'function') {
                return;
            }

            const componentActions = component.getDispatcherActions(actionSet, isClientAction);
            componentActions.forEach(({ staticMethod, staticMethodName, mapParamsToProps, initClientAction }) => {
                const componentActionMethod = staticMethod || component[staticMethodName];
                componentActionMethod(
                    { location, match },
                    mapParamsToProps(Object.assign(clientParams, initClientAction(clientParams)), routerCtx),
                    routerCtx);
            });
        });
    });

    return clientParams;
}
