// @flow
import React from 'react';
import getDisplayName from 'react-display-name';
import hoistNonReactStatics from 'hoist-non-react-statics';
import invariant from 'invariant';
import warning from 'warning';

const __DEV__ = process.env.NODE_ENV !== 'production';

function hoistSafeStatics(targetComponent, sourceComponent, blacklist = {}) {
    return hoistNonReactStatics(targetComponent, sourceComponent, Object.assign({
        // prevent hoisting the following static methods
        getDispatcherActions: true,
        getDispatchParamToProps: true,
        getDispatchParamsToProps: true,
        appendActionDispatcher: true,
        WrappedComponent: true
    }, blacklist));
}

export default function withActions(mapParamsToProps, ...actions) {
    if (!(typeof mapParamsToProps === 'undefined' || mapParamsToProps === null)) {
        invariant(typeof mapParamsToProps === 'function', '"mapParamsToProps" must be either a function, or null.');
    }

    if (typeof actions !== 'undefined' && actions !== null) {
        actions = Array.isArray(actions) ? actions : [actions];
    }

    invariant(actions.length !== 0, '"withActions(null, [action])" requires a minimum of 1 action, pass null as the first parameter if no "mapParamsToProps" function is required.');

    const paramsToProps = mapParamsToProps || (params => params);

    if (__DEV__) {
        actions.forEach(
            ({
                 name,
                 staticMethod,
                 staticMethodName,
                 filterParamsToProps,
                 initServerAction,
                 initClientAction,
                 hoc
            }) => {

            invariant(typeof name !== 'undefined', `Action requires a 'name' property.`);
            invariant(typeof name === 'string', `Action expects 'name' to be a string.`);

            if (typeof staticMethod !== 'undefined') {
                invariant(
                    typeof staticMethod === 'function',
                    `Action '${name}' expects 'staticMethod' to be a function.`);
            }
            else {
                invariant(
                    typeof staticMethodName !== 'undefined',
                    `Action '${name}' requires a 'staticMethodName' property.`);
                invariant(
                    typeof staticMethodName === 'string',
                    `Action '${name}' expects 'staticMethodName' to be a string.`);
            }

            invariant(
                typeof filterParamsToProps !== 'undefined',
                `Action '${name}' requires a 'filterParamsToProps' property.`);
            invariant(
                typeof filterParamsToProps === 'function',
                `Action '${name}' expects 'filterParamsToProps' to be a function.`);

            if (typeof initServerAction !== 'undefined') {
                invariant(
                    typeof initServerAction === 'function',
                    `Action '${name}' expects 'initServerAction' to be a function.`);
            }

            if (typeof initClientAction !== 'undefined') {
                invariant(
                    typeof initClientAction === 'function',
                    `Action '${name}' expects 'initClientAction' to be a function.`);
            }

            if (typeof hoc !== 'undefined') {
                invariant(
                    typeof hoc === 'function',
                    `Action '${name}' expects 'hoc' to be a function.`);
            }
        });
    }

    return (Component) => {
        const hocDispatcherActions = actions.slice();
        const isComponentNull = Component === null;
        let ComposedComponent = null;

        let actionHOC = (props) => isComponentNull ? null : React.createElement(ComposedComponent, props);

        actionHOC.appendActionDispatcher = function appendActionDispatcher(ActionDispatcherComponent, hocBlacklist = {}) {
            if (typeof ActionDispatcherComponent === 'undefined' ||
                ActionDispatcherComponent === null ||
                typeof ActionDispatcherComponent.getDispatcherActions !== 'function') {
                // Ignore non dispatcher components
                return;
            }

            Array.prototype.unshift.apply(hocDispatcherActions, ActionDispatcherComponent.getDispatcherActions());
            hoistSafeStatics(actionHOC, ActionDispatcherComponent, hocBlacklist);
        };

        // Compose the actions (components)
        ComposedComponent = actions.reduceRight((child, { hoc }) => {
            if (typeof hoc !== 'function') {
                return child;
            }

            const wrappedComponent = hoc(child, actionHOC);
            const composedHOC = (child === null || wrappedComponent === child) ?
                wrappedComponent :
                hoistSafeStatics(wrappedComponent, child);

            if (child !== null) {
                composedHOC.WrappedComponent = child;

                if (typeof child.getDispatcherActions === 'function') {
                    Array.prototype.unshift.apply(hocDispatcherActions, child.getDispatcherActions());
                }
            }

            return composedHOC;
        }, Component);

        if (actions.length === 1 && !isComponentNull && typeof Component.getDispatcherActions === 'function') {
            // reduceRight() is not invoked when there is only a single action
            Array.prototype.unshift.apply(hocDispatcherActions, Component.getDispatcherActions());
        }

        if (__DEV__) {
            if (!isComponentNull) {
                actions.forEach(({name, staticMethod, staticMethodName}) => {
                    if (typeof staticMethod !== 'function') {
                        invariant(
                            typeof ComposedComponent[staticMethodName] === 'function',
                            `Component '${getDisplayName(Component)}' is using action '${name}' but missing the required static method '${staticMethodName}'.`);
                    }
                    else {
                        warning(
                            typeof ComposedComponent[staticMethodName] !== 'function',
                            `Component '${getDisplayName(Component)}' defines the static method '${staticMethodName}' for action '${name}', but it will never be invoked as the action has a static method assigned.`);
                    }
                });
            }
        }

        actionHOC.displayName = `withActions(${isComponentNull ? 'null' : getDisplayName(ComposedComponent)})`;

        if (!isComponentNull) {
            actionHOC = hoistSafeStatics(actionHOC, ComposedComponent);
            actionHOC.WrappedComponent = ComposedComponent;
        }

        actionHOC.getDispatcherActions = function getDispatcherActions(
            permittedActionNames: Array<string> = [],
            filter: (action: Object) => boolean = () => true
        ) {
            permittedActionNames = permittedActionNames || [];
            return hocDispatcherActions.filter(action => {
                return (permittedActionNames.length === 0 ?
                    true :
                    permittedActionNames.indexOf(action.name) !== -1) && filter(action);
            })
        };

        actionHOC.getDispatchParamToProps = function getDispatchParamToProps() {
            return paramsToProps;
        };

        return actionHOC;
    };
}
