// @flow
import React from 'react';
import invariant from 'invariant';
import { matchRoutes } from 'react-router-config';
import getDisplayName from 'react-display-name';

export function resolveRouteComponents(branch, routeComponentPropNames) {
    const routeComponents = [];
    branch.forEach(({ route, match }) => {
        // get the route component(s) for each route
        routeComponentPropNames.forEach((propName) => {
            if (React.isValidElement(route[propName]) || typeof route[propName] === 'function') {
                routeComponents.push([route[propName], match]);
            }
        });
    });

    return routeComponents
}

export function resolveActionSets(routeComponents, dispatchActions) {
    // batch each actionSet using Promise.all()
    return dispatchActions.map((actionSet) => {
        const promises = [];
        routeComponents.forEach(([component, match]) => {
            actionSet.forEach((action) => {
                const componentAction = component[action];
                if (typeof componentAction === 'function') {
                    promises.push([componentAction, match]);
                }
                else if (typeof componentAction !== 'undefined') {
                    invariant(false, `Component '${getDisplayName(component)}' static action '${action}' is expected to be a function.`);
                }
            });
        });

        return promises;
    });
}

function createActionSetPromise(actionSet, helpers) {
    return Promise.all(actionSet.map(([componentAction, match]) => {
        return Promise.resolve(componentAction(match, helpers));
    }));
}

export function reduceActionSets(actionSets, helpers) {
    let promiseActionSet = createActionSetPromise(actionSets.shift(), helpers);

    while (actionSets.length > 0) {
        const actionSet = actionSets.shift();
        promiseActionSet = promiseActionSet.then(() => createActionSetPromise(actionSet, helpers));
    }

    return promiseActionSet;
}

export default function dispatchRouteActions(location, props) {
    const { routes, dispatchActions, routeComponentPropNames, helpers } = props;
    const branch = matchRoutes(routes, location.pathname);
    if (!branch.length) {
        return Promise.resolve();
    }

    // Determine all RouteComponent(s) matched for the current route
    const routeComponents = resolveRouteComponents(branch, routeComponentPropNames);
    const actionSets = resolveActionSets(routeComponents, dispatchActions);
    return reduceActionSets(actionSets, helpers);
}
