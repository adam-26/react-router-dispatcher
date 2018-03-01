// @flow
import React from 'react';
import invariant from 'invariant';
import { matchRoutes } from 'react-router-config';

// TODO: Remove the need for any default parameters
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

                // Determine the component mapper - lifecycle methods should NOT map prop values
                const componentParamsToProps = isLifecycleMethod ? (p => p) : component.getDispatchParamToProps();

                const { staticMethod, staticMethodName } = componentAction;
                const actionMethod = staticMethod || component[staticMethodName];
                promises.push([actionMethod, match, routerContext, componentParamsToProps]);
            });

            if (action === null) {
                return;
            }

            const { name, successHandler, errorHandler, stopServerActions, filterParamsToProps } = action;
            resolvedActionSets.push({
                name: name,
                routeActions: promises,
                actionSuccessHandler: typeof successHandler === 'function' ? successHandler : () => null,
                actionErrorHandler: typeof errorHandler === 'function' ? errorHandler : err => { throw err },
                stopServerActions: typeof stopServerActions === 'function' ? stopServerActions : false, // here or bundled with route actions?
                initParams:
                    (typeof initParamFuncName === 'string' && action[initParamFuncName]) || (params => params),
                filterParams: isLifecycleMethod ?
                    props => props :
                    filterParamsToProps
            });

        });
    });

    return resolvedActionSets;
}

function createActionSetPromise(resolvedActionSet, location, actionParams, props) {
    const {
        routeActions,
        actionSuccessHandler,
        actionErrorHandler,
        stopServerActions,
        initParams,
        filterParams
    } = resolvedActionSet;

    // This is a 2-step process - first init & assign the action parameters, this data is returned to the caller
    const filteredParams = filterParams(Object.assign(actionParams, initParams(actionParams)));
    // Then, append the route 'location' to the props that are passed to all action methods
    // - this prevents the 'location' data from being returned to the caller
    const filteredProps = Object.assign({ location }, filteredParams);

    // Invoke each route action
    return Promise.all(routeActions.map(([componentAction, match, routerContext, componentParamsToProps]) => {
        return Promise.resolve(componentAction(
            {
                ...componentParamsToProps(props, routerContext),
                ...filteredProps,
                match
            },
            routerContext));
        })
    )

    // Invoke any configured post-action handlers
    .then(() => Promise.resolve(actionSuccessHandler(filteredProps)))

    // Handle any action-specific error(s)
    .catch(err => actionErrorHandler(err, filteredProps))

    // determine if the next action set should be invoked
    .then(() => Promise.resolve(
        // eslint-disable-next-line no-unused-vars
        !routeActions.some(([ componentAction, match, routerContext ]) =>
            stopServerActions === false ?
                false :
                stopServerActions({ ...filteredProps, match }, routerContext))
    ));
}

export function reduceActionSets(resolvedActionSets, location, props) {
    const actionParams = Object.assign({}, defaultParams);
    let promiseActionSet = Promise.resolve(true); // always start w/true to invoke the first actionSet

    while (resolvedActionSets.length > 0) {
        const resolvedActionSet = resolvedActionSets.shift(); // IMPORTANT: don't refactor this inside the promise fn
        promiseActionSet = promiseActionSet
            .then((invokeActions) =>
                invokeActions ? createActionSetPromise(resolvedActionSet, location, actionParams, props) : Promise.resolve(invokeActions));
    }

    return promiseActionSet.then(() => Promise.resolve(actionParams));
}

export function matchRouteComponents(location, routes, routeComponentPropNames) {
    const branch = matchRoutes(routes, location.pathname);
    if (!branch.length) {
        return [];
    }

    return resolveRouteComponents(branch, routeComponentPropNames);
}

export function dispatchRouteActions(location, actions, routeConfig, props, initParamFuncName, isLifecycleMethod, actionFilter) {
    const { routes, routeComponentPropNames } = routeConfig;

    // Determine all RouteComponent(s) matched for the current route
    const routeComponents = matchRouteComponents(location, routes, routeComponentPropNames);
    if (routeComponents.length === 0) {
        return Promise.resolve();
    }

    const dispatchActions = typeof actions === 'function' ?
        parseDispatchActions(actions(location, props)) :
        actions;

    const actionSets = resolveActionSets(
        routeComponents,
        dispatchActions,
        initParamFuncName,
        isLifecycleMethod,
        actionFilter);

    return reduceActionSets(actionSets, location, props);
}

export function parseDispatchActions(dispatchActions) {
    if (typeof dispatchActions === 'string') {
        return [[dispatchActions]];
    }

    if (Array.isArray(dispatchActions)) {

        // Is a single action set defined?
        if (dispatchActions.every(action => typeof action === 'string')) {
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
 * @param props
 */
export function dispatchComponentActions(location, actionNames, routeConfig, props) {
    return dispatchRouteActions(
        location,
        actionNames,
        routeConfig,
        props,
        'initComponentAction',
        true);
}

/**
 * Dispatches asynchronous actions on the server
 *
 * @param location
 * @param actionNames
 * @param routeConfig
 * @param props
 * @returns {*}
 */
export function dispatchServerActions(location, actionNames, routeConfig, props) {
    return dispatchRouteActions(
        location,
        standardizeActionNames(actionNames),
        routeConfig,
        props,
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
 * @param props
 * @returns {*}
 */
export function dispatchClientActions(location, actionNames, routeConfig, props) {
    const { routes, routeComponentPropNames } = routeConfig;

    const actionParams = Object.assign({}, defaultParams); // used for internal action parameters
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
            const componentParamsToProps = component.getDispatchParamToProps();

            componentActions.forEach(({ staticMethod, staticMethodName, filterParamsToProps, initClientAction }) => {
                const componentActionMethod = staticMethod || component[staticMethodName];

                componentActionMethod(
                    {
                        ...componentParamsToProps(props, routerCtx),
                        ...filterParamsToProps(Object.assign(actionParams, initClientAction(actionParams))),
                        location,
                        match
                    },
                    routerCtx);
            });
        });
    });

    return actionParams;
}
