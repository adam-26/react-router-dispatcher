// @flow
import React from 'react';
import getDisplayName from 'react-display-name';
import hoistNonReactStatics from 'hoist-non-react-statics';
import invariant from 'invariant';
import warning from 'warning';

const __DEV__ = process.env.NODE_ENV !== 'production';

export default function withActions(...actions) {
    if (__DEV__) {
        actions.forEach(
            ({
                 name,
                 staticMethod,
                 staticMethodName,
                 mapParamsToProps,
                 initServerAction,
                 initClientAction,
                 hoc,
                 requireMapParamsToProps
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

            if (requireMapParamsToProps === true) {
                invariant(
                    typeof mapParamsToProps !== 'undefined',
                    `Action '${name}' requires a 'mapParamsToProps' property.`);
                invariant(
                    typeof mapParamsToProps === 'function',
                    `Action '${name}' expects 'mapParamsToProps' to be a function.`);
            }

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

        // Compose the actions (components)
        const ComposedComponent = actions.reduceRight((child, { hoc }) => {
            if (typeof hoc !== 'function') {
                return child;
            }

            const HOC = child === null ? hoc(child) : hoistNonReactStatics(hoc(child), child);
            if (child !== null) {
                HOC.WrappedComponent = child;

                if (typeof child.getDispatcherActions === 'function') {
                    Array.prototype.unshift.apply(hocDispatcherActions, child.getDispatcherActions());
                }
            }

            return HOC;
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

        let HOC = (props) => isComponentNull ? null :(<ComposedComponent {...props} />);

        HOC.displayName = `withActions(${isComponentNull ? 'null' : getDisplayName(ComposedComponent)})`;

        if (!isComponentNull) {
            HOC = hoistNonReactStatics(HOC, ComposedComponent);
            HOC.WrappedComponent = ComposedComponent;
        }

        HOC.getDispatcherActions = function getDispatcherActions(
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

        return HOC;
    };
}
