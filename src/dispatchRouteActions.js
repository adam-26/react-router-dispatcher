// @flow
import React from 'react';
import invariant from 'invariant';
import { matchRoutes } from 'react-router-config';
import getDisplayName from 'react-display-name';

export function parseDispatchActions(dispatchActions) { // todo; add opt for client/server - so on client 'server' actions can be removed.
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

            if (typeof actionSet === 'string') { // todo; this needs to change... where are the ACTIONs resolved?
                return [actionSet];
            }

            invariant(false, `Invalid dispatch action, '${actionSet}', expected string or array.`);
        });
    }

    invariant(false, 'Invalid dispatch actions, expected string or array.');
}

function isRouteComponent(routeComponent) {
    return React.isValidElement(routeComponent) || typeof routeComponent === 'function';
}

function addRouteComponent(component, match, route, routeComponentKey, target) {
    target.push([component, match, { route, routeComponentKey }]);
}

export function resolveRouteComponents(branch, routeComponentPropNames) {
    const routeComponents = [];
    branch.forEach(({ route, match }) => {
        // get the route component(s) for each route
        routeComponentPropNames.forEach((propName) => {
            const routeComponent = route[propName];
            if (isRouteComponent(routeComponent)) {
                addRouteComponent(routeComponent, match, route, propName, routeComponents);
            }
            else if (routeComponent !== null && typeof routeComponent === 'object') {
                // support assigning component(s) using key/value pairs (object)
                Object.keys(routeComponent).forEach(componentName => {
                    const component = routeComponent[componentName];
                    if (isRouteComponent(component)) {
                        addRouteComponent(component, match, route, `${propName}.${componentName}`, routeComponents);
                    }
                });
            }
        });
    });

    return routeComponents
}

export function resolveActionSets(routeComponents, dispatchActions) {
    const actionSets = parseDispatchActions(dispatchActions);
    return actionSets.map((actionSet) => {
        const promises = [];
        routeComponents.forEach(([component, match, routerContext]) => {
            actionSet.forEach((action) => {
                const componentAction = component[action];
                if (typeof componentAction === 'function') {
                    promises.push([componentAction, match, routerContext]);
                }
                else if (typeof componentAction !== 'undefined') {
                    invariant(false, `Component '${getDisplayName(component)}' static action '${action}' is expected to be a function.`);
                }
            });
        });

        return promises;
    });
}

function createActionSetPromise(actionSet, actionParams, location) {
    return Promise.all(actionSet.map(([componentAction, match, routerContext]) => {
        return Promise.resolve(componentAction({ location, match }, actionParams, routerContext));
    }));
}

export function reduceActionSets(actionSets, actionParams, location) {
    let promiseActionSet = createActionSetPromise(actionSets.shift(), actionParams, location);

    while (actionSets.length > 0) {
        const actionSet = actionSets.shift();
        promiseActionSet = promiseActionSet.then(() => createActionSetPromise(actionSet, actionParams, location));
    }

    return promiseActionSet;
}

export function matchRouteComponents(location, routes, routeComponentPropNames) {
    const branch = matchRoutes(routes, location.pathname);
    if (!branch.length) {
        return [];
    }

    return resolveRouteComponents(branch, routeComponentPropNames);
}

export default function dispatchRouteActions(location, props) {
    const { routes, dispatchActions, routeComponentPropNames, actionParams } = props;

    // Determine all RouteComponent(s) matched for the current route
    const routeComponents = matchRouteComponents(location, routes, routeComponentPropNames);
    if (routeComponents.length === 0) {
        return Promise.resolve();
    }
    
    const actionSets = resolveActionSets(
        routeComponents,
        typeof dispatchActions === 'function' ? dispatchActions(location, actionParams) : dispatchActions);

    return reduceActionSets(actionSets, actionParams, location);
}
